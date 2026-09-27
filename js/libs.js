// Third-party libraries, loaded lazily as ESM from jsDelivr (latest stable).
// Each loader retries on the next call if the network failed.

import { SUPABASE_URL } from '../config.js';

const CDN = 'https://cdn.jsdelivr.net/npm/';
const ENTRIES = ['canvas-confetti/+esm', 'qrcode/+esm', 'lz-string/+esm'];
if (SUPABASE_URL) ENTRIES.push('@supabase/supabase-js/+esm');

function lazy(url, pick = (m) => m) {
  let p = null;
  return () => {
    p ||= import(url).then(pick).catch((err) => {
      p = null;
      throw err;
    });
    return p;
  };
}

const def = (m) => m.default || m;

export const loadSupabase = lazy(CDN + '@supabase/supabase-js/+esm');
export const loadConfetti = lazy(CDN + 'canvas-confetti/+esm', def);
export const loadQRCode = lazy(CDN + 'qrcode/+esm', def);
export const loadLZ = lazy(CDN + 'lz-string/+esm', def);

/**
 * Fetch each library and everything it imports through the service worker,
 * so they're in its cache for offline use (jsDelivr's +esm files import
 * their dependencies as "/npm/pkg@x.y.z/+esm").
 */
async function warmCache(url, seen = new Set()) {
  if (seen.has(url) || seen.size > 40) return;
  seen.add(url);
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) return;
  const text = await res.text();
  const deps = [...text.matchAll(/(?:from|import)\s*\(?\s*["'](\/npm\/[^"']+)["']/g)].map((m) => 'https://cdn.jsdelivr.net' + m[1]);
  await Promise.all(deps.map((d) => warmCache(d, seen).catch(() => {})));
}

const WARM_KEY = 'gdb:libsWarmedAt';

/** In idle time: load the small libraries now, and warm the offline cache once a day. */
export function prefetchLibs() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(() => {
    loadLZ().catch(() => {});
    loadConfetti().catch(() => {});
    loadQRCode().catch(() => {});
  }, { timeout: 6000 });

  const warm = () => {
    if (!navigator.serviceWorker?.controller || navigator.onLine === false) return;
    let last = 0;
    try { last = Number(localStorage.getItem(WARM_KEY)) || 0; } catch { /* ignore */ }
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    idle(() => {
      const seen = new Set();
      Promise.all(ENTRIES.map((e) => warmCache(CDN + e, seen)))
        .then(() => { try { localStorage.setItem(WARM_KEY, String(Date.now())); } catch { /* ignore */ } })
        .catch(() => {});
    }, { timeout: 10000 });
  };
  if (navigator.serviceWorker?.controller) warm();
  else navigator.serviceWorker?.addEventListener('controllerchange', warm, { once: true });
}
