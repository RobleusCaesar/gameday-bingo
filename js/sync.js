// Supabase Realtime as a pipe only: Broadcast + Presence on channel "game:{CODE}".
// No tables, nothing stored server-side. Each device owns its own board and score.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { loadSupabase } from './libs.js';

export const EVENTS = ['mark', 'unmark', 'bingo', 'request_config', 'config', 'end'];

export function syncConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let clientPromise = null;
const removals = new Map(); // code -> promise of a channel being torn down

/** Leave a channel if it's still joined, then make sure the client forgets it. */
function dropChannel(sb, ch) {
  const forget = () => {
    try { ch.teardown?.(); } catch { /* ignore */ }
    try { sb.realtime?._remove?.(ch); } catch { /* ignore */ }
  };
  if (ch.state === 'joined' || ch.state === 'joining') {
    return sb.removeChannel(ch).catch(() => {}).then(() => { if (sb.getChannels().includes(ch)) forget(); });
  }
  forget();
  return Promise.resolve();
}
function client() {
  clientPromise ||= loadSupabase()
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15000 },
    }))
    .catch((err) => {
      clientPromise = null;
      throw err;
    });
  return clientPromise;
}

/**
 * One realtime channel for one game.
 * handlers: { status(s), presence(stateByKey), broadcast(event, payload) }
 * status: 'off' (not configured) | 'connecting' | 'live' | 'offline'
 */
export class GameChannel {
  constructor(code, presenceKey, handlers) {
    this.code = code;
    this.key = presenceKey;
    this.h = handlers;
    this.status = 'off';
    this.channel = null;
    this.summary = null;
    this.closed = false;
    this._trackTimer = null;
    this._retryTimer = null;
    this._onOnline = () => this._resume();
    this._onOffline = () => this._set('offline');
    // Phones suspend sockets in the background; check the line when we come back.
    this._onVisible = () => {
      if (document.visibilityState !== 'visible' || !this.channel) return;
      try { this.sb.realtime.sendHeartbeat(); } catch { /* ignore */ }
      this._resume();
    };
  }

  _set(s) {
    if (this.status === s) return;
    this.status = s;
    this.h.status?.(s);
  }

  async open() {
    if (!syncConfigured()) { this._set('off'); return; }
    if (this.closed) return;
    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
    document.addEventListener('visibilitychange', this._onVisible);
    clearTimeout(this._retryTimer);
    if (this.channel) return;
    this._set('connecting');
    let sb;
    try {
      sb = await client();
    } catch {
      this._set('offline');
      this._retryTimer = setTimeout(() => this.open(), 15000);
      return;
    }
    // supabase.channel() hands back an existing channel with the same topic,
    // so wait for any previous one for this game to finish tearing down.
    await removals.get(this.code);
    if (this.closed || this.channel) return;
    const topic = `realtime:game:${this.code}`;
    for (const stale of sb.getChannels().filter((c) => c.topic === topic)) await dropChannel(sb, stale);
    if (this.closed || this.channel) return;
    this.sb = sb;
    const ch = sb.channel(`game:${this.code}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.key }, private: false },
    });
    this.channel = ch;
    ch.on('presence', { event: 'sync' }, () => this.h.presence?.(ch.presenceState()));
    for (const ev of EVENTS) {
      ch.on('broadcast', { event: ev }, (msg) => this.h.broadcast?.(ev, msg.payload || {}));
    }
    ch.subscribe((status) => {
      if (this.closed || ch !== this.channel) return;
      if (status === 'SUBSCRIBED') {
        this._set('live');
        if (this.summary) ch.track(this.summary).catch(() => {});
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this._set(navigator.onLine === false ? 'offline' : 'connecting');
        if (status === 'CLOSED') {
          // Server closed us; forget this channel (guarded above against re-entry) and rebuild shortly.
          this.channel = null;
          const done = dropChannel(sb, ch);
          removals.set(this.code, done);
          clearTimeout(this._retryTimer);
          this._retryTimer = setTimeout(() => this.open(), 4000);
        }
      }
    });
  }

  /** Back online (or app back in front): re-check the channel and re-publish. */
  _resume() {
    if (this.closed || !syncConfigured()) return;
    if (!this.channel) { this.open(); return; }
    try { if (!this.sb.realtime.isConnected()) this.sb.realtime.connect(); } catch { /* ignore */ }
    if (this.channel.state === 'joined') {
      this._set('live');
      if (this.summary) this.channel.track(this.summary).catch(() => {});
    } else {
      this._set('connecting'); // realtime-js rejoins on its own and fires SUBSCRIBED
    }
  }

  /** Publish this player's summary via Presence (throttled). */
  track(summary) {
    this.summary = summary;
    if (this._trackTimer) return;
    this._trackTimer = setTimeout(() => {
      this._trackTimer = null;
      if (this.status === 'live' && this.channel) this.channel.track(this.summary).catch(() => {});
    }, 200);
  }

  send(event, payload) {
    if (this.status !== 'live' || !this.channel) return false;
    this.channel.send({ type: 'broadcast', event, payload }).catch(() => {});
    return true;
  }

  close() {
    this.closed = true;
    clearTimeout(this._trackTimer);
    clearTimeout(this._retryTimer);
    window.removeEventListener('online', this._onOnline);
    window.removeEventListener('offline', this._onOffline);
    document.removeEventListener('visibilitychange', this._onVisible);
    if (this.channel && this.sb) {
      const ch = this.channel;
      const sb = this.sb;
      this.channel = null; // before leaving, so the CLOSED callback ignores it
      const done = dropChannel(sb, ch).then(() => {
        if (removals.get(this.code) === done) removals.delete(this.code);
      });
      removals.set(this.code, done);
    }
    this.channel = null;
  }
}

/**
 * Ask any peer in a game for its config (used when joining with a bare code).
 * Resolves with the raw config or null on timeout / offline.
 */
export async function requestConfig(code, { timeout = 9000, key } = {}) {
  if (!syncConfigured()) return null;
  return new Promise((resolve) => {
    let finished = false;
    let timer = null;
    let ask = null;
    const finish = (cfg) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(ask);
      ch.close();
      resolve(cfg);
    };
    const ch = new GameChannel(code, key || 'joiner-' + Math.random().toString(36).slice(2), {
      status: (s) => {
        if (s === 'live') {
          ch.send('request_config', { from: ch.key });
          ask = setInterval(() => ch.send('request_config', { from: ch.key }), 1500);
        }
      },
      broadcast: (ev, payload) => {
        if (ev === 'config' && payload && payload.config) finish(payload.config);
      },
    });
    timer = setTimeout(() => finish(null), timeout);
    ch.open();
  });
}
