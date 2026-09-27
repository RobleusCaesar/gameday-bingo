// A game on this device: config snapshot, my board, marks, score, the players
// I've seen, and the feed. Persisted under gdb:game:{CODE}.
import * as store from './store.js';
import { generateBoard, normText } from './board.js';
import { evaluate, bingoKeys, marksToBits, compareStandings, POINTS, CENTER, labelForKey } from './rules.js';
import { profile } from './settings.js';
import { GameChannel } from './sync.js';
import { newCode } from './rng.js';
import { sanitizeConfig, sanitizeStandings, fill } from './share.js';

const FEED_MAX = 150;
export const ANYONE_CAN_END_AFTER = 4 * 60 * 60 * 1000;

const gameKey = (code) => 'game:' + code;

export function listGames() {
  return store.keys('game:')
    .map((k) => store.get(k))
    .filter((g) => g && g.code && g.config)
    .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
}

export function hasGame(code) {
  return !!store.get(gameKey(code));
}

export function deleteGame(code) {
  if (current && current.code === code) closeCurrent();
  store.remove(gameKey(code));
}

let current = null;

export function currentSession() {
  return current;
}

// Flush any debounced write when the app is hidden or closed.
window.addEventListener('pagehide', () => current?.save(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') current?.save(true);
});

export function closeCurrent() {
  current?.disconnect();
  current = null;
}

/** Open (and connect) a saved game. Returns null if it doesn't exist. */
export function openSession(code) {
  if (current && current.code === code) return current;
  const state = store.get(gameKey(code));
  if (!state) return null;
  closeCurrent();
  current = new GameSession(state);
  current.state.lastOpenedAt = Date.now();
  current.save(true);
  current.connect();
  return current;
}

/** Host a new game from a pack. */
export function createGame({ pack, opp, team, win, mix }) {
  const me = profile();
  let code = newCode();
  while (hasGame(code)) code = newCode();
  const config = {
    v: 1,
    code,
    rev: 0,
    packId: pack.id,
    packName: pack.name,
    squares: pack.squares.map((s) => ({ t: s.t, r: s.r })),
    opp: (opp || '').trim().slice(0, 30),
    team: (team || '').trim().slice(0, 30),
    win: { corners: !!win.corners, x: !!win.x, blackout: !!win.blackout },
    mix,
    hostId: me.id,
    hostName: me.name,
    hostEmoji: me.emoji,
    createdAt: Date.now(),
  };
  const state = newState(config, 'host');
  store.set(gameKey(code), state);
  return openSession(code);
}

/** Join from a (sanitized) config. Reuses the saved game if we already have it. */
export function joinGame(rawConfig) {
  const config = sanitizeConfig(rawConfig);
  if (!config) return null;
  const existing = store.get(gameKey(config.code));
  if (existing) {
    const s = openSession(config.code);
    s.applyConfig(config);
    return s;
  }
  const me = profile();
  const state = newState(config, config.hostId === me.id ? 'host' : 'player');
  store.set(gameKey(config.code), state);
  return openSession(config.code);
}

function newState(config, role) {
  const me = profile();
  const marks = Array(25).fill(false);
  marks[CENTER] = true;
  return {
    v: 1,
    code: config.code,
    role,
    config,
    rerolls: 0,
    board: buildBoard(config, me.id, 0),
    marks,
    celebrated: [],
    firstBingoDone: false,
    firstInGame: null,
    players: {},
    feed: [],
    status: config.endedAt ? 'ended' : 'live',
    final: config.final || null,
    endedAt: config.endedAt || null,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  };
}

function buildBoard(config, playerId, rerolls) {
  const seed = config.code + ':' + playerId + (rerolls ? ':reroll' + rerolls : '');
  return generateBoard(config.squares, config.mix, seed);
}

export class GameSession extends EventTarget {
  constructor(state) {
    super();
    this.state = state;
    this.me = profile();
    this.channel = null;
    this.syncStatus = 'off';
    this._saveTimer = null;
    this._configReplyTimer = null;
    this._eval = null;
    this._migrate();
  }

  _migrate() {
    const s = this.state;
    s.players ||= {};
    s.feed ||= [];
    s.celebrated ||= [];
    if (!Array.isArray(s.marks) || s.marks.length !== 25) {
      s.marks = Array(25).fill(false);
    }
    s.marks[CENTER] = true;
  }

  get code() { return this.state.code; }
  get config() { return this.state.config; }
  get board() { return this.state.board; }
  get marks() { return this.state.marks; }
  get ended() { return this.state.status === 'ended'; }
  get isHost() { return this.state.role === 'host' || this.config.hostId === this.me.id; }
  get markCount() { return this.marks.filter(Boolean).length - 1; }

  text(i) {
    const sq = this.board[i];
    return sq ? fill(sq.t, this.config) : 'FREE';
  }

  evaluate() {
    this._eval ||= evaluate(this.board, this.marks, this.config.win);
    return this._eval;
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  save(now = false) {
    clearTimeout(this._saveTimer);
    const write = () => store.set(gameKey(this.code), this.state);
    if (now) write(); else this._saveTimer = setTimeout(write, 150);
  }

  /* ---------- My board ---------- */

  canReroll() {
    return !this.ended && this.state.rerolls < 1 && this.markCount === 0;
  }

  reroll() {
    if (!this.canReroll()) return false;
    this.state.rerolls += 1;
    this.state.board = buildBoard(this.config, this.me.id, this.state.rerolls);
    this._eval = null;
    this.save(true);
    this.publish();
    this.emit('board');
    return true;
  }

  /**
   * Toggle a cell. Returns what changed so the UI can celebrate.
   */
  toggle(i) {
    if (this.ended || i === CENTER || !this.board[i]) return null;
    const before = this.evaluate();
    const marked = !this.marks[i];
    this.marks[i] = marked;
    this._eval = null;
    const after = this.evaluate();
    const now = Date.now();
    this.state.lastEventAt = now;

    const prevKeys = new Set(bingoKeys(before));
    const completed = bingoKeys(after).filter((k) => !prevKeys.has(k));
    const fresh = completed.filter((k) => !this.state.celebrated.includes(k));
    this.state.celebrated.push(...fresh);
    const firstMine = fresh.length > 0 && !this.state.firstBingoDone;
    if (firstMine) this.state.firstBingoDone = true;
    let firstInGame = false;
    if (fresh.length && !this.state.firstInGame) {
      this.state.firstInGame = { pid: this.me.id, name: this.me.name, emoji: this.me.emoji, at: now };
      firstInGame = true;
    }

    const sq = this.board[i];
    const text = fill(sq.t, this.config);
    this.addFeed({ type: marked ? 'mark' : 'unmark', pid: this.me.id, name: this.me.name, emoji: this.me.emoji, text, at: now });
    this.channel?.send(marked ? 'mark' : 'unmark', { ...this.summary(), t: sq.t, r: sq.r });
    if (fresh.length) {
      const label = fresh.map(labelForKey).find((l) => l !== 'Line') || 'Line';
      this.addFeed({ type: 'bingo', pid: this.me.id, name: this.me.name, emoji: this.me.emoji, label, at: now });
      this.channel?.send('bingo', { ...this.summary(), keys: fresh, label, first: firstInGame });
    }
    this.publish();
    this.save(true); // marks are precious: write now, not debounced
    this.emit('change');
    return {
      marked,
      points: POINTS[sq.r] || 1,
      completed,
      fresh,
      firstMine,
      firstInGame,
      ev: after,
    };
  }

  /* ---------- Players & leaderboard ---------- */

  summary() {
    const ev = this.evaluate();
    return {
      pid: this.me.id,
      name: this.me.name,
      emoji: this.me.emoji,
      points: ev.points,
      bingos: ev.bingos,
      marks: marksToBits(this.marks),
      lastEventAt: this.state.lastEventAt || 0,
      host: this.isHost,
      rev: this.config.rev || 0,
      ended: this.ended ? 1 : 0,
    };
  }

  publish() {
    this.channel?.track(this.summary());
  }

  standings() {
    if (this.ended && this.state.final?.length) {
      return this.state.final.map((p) => ({ ...p, me: p.pid === this.me.id, online: true }));
    }
    const list = Object.values(this.state.players)
      .filter((p) => p.pid !== this.me.id)
      .map((p) => ({ ...p, me: false }));
    list.push({ ...this.summary(), me: true, online: true });
    return list.sort(compareStandings);
  }

  myRank() {
    const list = this.standings();
    return { rank: list.findIndex((p) => p.me) + 1, of: list.length };
  }

  onlineCount() {
    if (this.syncStatus !== 'live') return 1;
    return 1 + Object.values(this.state.players).filter((p) => p.online && p.pid !== this.me.id).length;
  }

  _updatePlayer(p, { online } = {}) {
    if (!p || typeof p.pid !== 'string' || p.pid === this.me.id) return null;
    const prev = this.state.players[p.pid];
    const next = {
      pid: p.pid.slice(0, 64),
      name: String(p.name || prev?.name || 'Player').slice(0, 18),
      emoji: String(p.emoji || prev?.emoji || '🏈').slice(0, 8),
      points: Math.max(0, Math.min(99999, Number(p.points) || 0)),
      bingos: Math.max(0, Math.min(99, Number(p.bingos) || 0)),
      marks: Number(p.marks) >>> 0,
      lastEventAt: Number(p.lastEventAt) || 0,
      host: !!p.host,
      online: online ?? prev?.online ?? true,
      seenAt: Date.now(),
    };
    this.state.players[p.pid] = next;
    return { prev, next };
  }

  /* ---------- Feed ---------- */

  addFeed(item) {
    item.id = item.at + ':' + Math.random().toString(36).slice(2, 7);
    this.state.feed.unshift(item);
    if (this.state.feed.length > FEED_MAX) this.state.feed.length = FEED_MAX;
    this.emit('feed', item);
  }

  /* ---------- Sync ---------- */

  connect() {
    if (this.channel) return;
    this.channel = new GameChannel(this.code, this.me.id, {
      status: (s) => {
        this.syncStatus = s;
        // (On 'live' the channel re-tracks our latest summary itself.)
        if (s !== 'live') Object.values(this.state.players).forEach((p) => { p.online = false; });
        this.emit('status', s);
        this.emit('players');
      },
      presence: (state) => this._onPresence(state),
      broadcast: (ev, payload) => this._onBroadcast(ev, payload),
    });
    this.channel.track(this.summary());
    this.channel.open();
  }

  disconnect() {
    clearTimeout(this._configReplyTimer);
    this.channel?.close();
    this.channel = null;
    this.save(true);
  }

  _onPresence(state) {
    const seen = new Set();
    let needConfig = false;
    for (const [key, metas] of Object.entries(state || {})) {
      if (!Array.isArray(metas) || !metas.length || key === this.me.id) continue;
      const meta = metas.reduce((a, b) => ((b.lastEventAt || 0) >= (a.lastEventAt || 0) ? b : a));
      const known = this.state.players[key];
      // Presence can lag a broadcast we already applied; never roll a score back.
      const res = known && (Number(meta.lastEventAt) || 0) < (known.lastEventAt || 0)
        ? this._updatePlayer({ ...known, name: meta.name, emoji: meta.emoji }, { online: true })
        : this._updatePlayer({ ...meta, pid: key }, { online: true });
      if (!res) continue;
      seen.add(key);
      if (!res.prev) {
        this.addFeed({ type: 'join', pid: key, name: res.next.name, emoji: res.next.emoji, at: Date.now() });
      }
      if ((meta.ended && !this.ended) || (Number(meta.rev) || 0) > (this.config.rev || 0)) needConfig = true;
    }
    for (const p of Object.values(this.state.players)) if (!seen.has(p.pid)) p.online = false;
    if (needConfig) this.channel?.send('request_config', { from: this.me.id });
    this.save();
    this.emit('players');
  }

  _onBroadcast(ev, p) {
    if (!p || typeof p !== 'object') return;
    switch (ev) {
      case 'mark':
      case 'unmark': {
        const res = this._updatePlayer(p);
        if (!res) return;
        const tmpl = String(p.t || '').slice(0, 80);
        const text = fill(tmpl, this.config);
        this.addFeed({ type: ev, pid: p.pid, name: res.next.name, emoji: res.next.emoji, text, at: Date.now() });
        if (ev === 'mark' && !this.ended) {
          const idx = this.board.findIndex((sq, i) => sq && !this.marks[i] && normText(sq.t) === normText(tmpl));
          if (idx >= 0) this.emit('quickmark', { idx, from: res.next, text });
        } else {
          this.emit('unquick', { pid: p.pid, text });
        }
        this.save();
        this.emit('players');
        break;
      }
      case 'bingo': {
        const res = this._updatePlayer(p);
        if (!res) return;
        let first = false;
        if (p.first && !this.state.firstInGame) {
          this.state.firstInGame = { pid: p.pid, name: res.next.name, emoji: res.next.emoji, at: Date.now() };
          first = true;
        }
        const label = ['Line', 'Four Corners', 'X', 'Blackout'].includes(p.label) ? p.label : 'Line';
        this.addFeed({ type: 'bingo', pid: p.pid, name: res.next.name, emoji: res.next.emoji, label, at: Date.now() });
        this.save();
        this.emit('players');
        this.emit('remote-bingo', { player: res.next, label, first });
        break;
      }
      case 'request_config': {
        // Anyone with the config answers; jitter so the channel isn't flooded.
        clearTimeout(this._configReplyTimer);
        const delay = this.isHost ? 30 : 150 + Math.random() * 450;
        this._configReplyTimer = setTimeout(() => {
          this.channel?.send('config', { config: this.shareableConfig() });
        }, delay);
        break;
      }
      case 'config': {
        clearTimeout(this._configReplyTimer); // someone else already answered
        const cfg = sanitizeConfig(p.config);
        if (cfg && cfg.code === this.code) this.applyConfig(cfg);
        break;
      }
      case 'end': {
        if (this.ended) return;
        this._applyEnd(sanitizeStandings(p.final), Number(p.endedAt) || Date.now(), String(p.byName || '').slice(0, 18));
        break;
      }
      default:
    }
  }

  shareableConfig() {
    const { packId, ...cfg } = this.config;
    if (this.ended) {
      cfg.endedAt = this.state.endedAt;
      cfg.final = this.state.final;
    }
    return cfg;
  }

  /** Accept a newer config from a peer: host square swaps (before marks) or game end. */
  applyConfig(cfg) {
    let changed = false;
    if ((cfg.rev || 0) > (this.config.rev || 0)) {
      const packId = this.config.packId;
      this.state.config = { ...cfg, packId };
      changed = true;
      if (this.markCount === 0) {
        this.state.board = buildBoard(this.state.config, this.me.id, this.state.rerolls);
        this._eval = null;
        this.emit('board');
      }
    }
    if (cfg.endedAt && !this.ended) {
      this._applyEnd(cfg.final || [], cfg.endedAt, '');
      changed = true;
    }
    if (changed) {
      this.save(true);
      this.publish();
    }
  }

  /** Host-only: swap one square in the lobby, before anyone has marked. */
  canSwap() {
    if (!this.isHost || this.ended) return false;
    if (this.markCount > 0) return false;
    return Object.values(this.state.players).every((p) => (p.marks >>> 0) === (1 << CENTER));
  }

  swapSquare(index, { t, r }) {
    if (!this.canSwap()) return false;
    const squares = this.config.squares.slice();
    squares[index] = { t: t.slice(0, 80), r };
    this.state.config = { ...this.config, squares, rev: (this.config.rev || 0) + 1 };
    this.state.board = buildBoard(this.state.config, this.me.id, this.state.rerolls);
    this._eval = null;
    this.save(true);
    this.publish();
    this.channel?.send('config', { config: this.shareableConfig() });
    this.emit('board');
    return true;
  }

  /* ---------- Ending ---------- */

  canEnd() {
    if (this.ended) return false;
    return this.isHost || Date.now() - (this.config.createdAt || 0) >= ANYONE_CAN_END_AFTER;
  }

  end() {
    if (!this.canEnd()) return false;
    const final = this.standings().map(({ pid, name, emoji, points, bingos, marks }) => ({ pid, name, emoji, points, bingos, marks }));
    const endedAt = Date.now();
    this.channel?.send('end', { final, endedAt, byName: this.me.name });
    this._applyEnd(final, endedAt, this.me.name);
    return true;
  }

  _applyEnd(final, endedAt, byName) {
    this.state.status = 'ended';
    this.state.endedAt = endedAt;
    // Make sure I'm on the podium with my own exact numbers.
    const mine = this.summary();
    const list = (final || []).filter((p) => p.pid !== this.me.id);
    list.push({ pid: mine.pid, name: mine.name, emoji: mine.emoji, points: mine.points, bingos: mine.bingos, marks: mine.marks });
    this.state.final = list.sort(compareStandings);
    this.addFeed({ type: 'end', name: byName, at: endedAt });
    this.save(true);
    this.publish();
    this.emit('ended', { byName });
    this.emit('players');
  }
}
