// Service worker: precaches the app shell so solo play works offline.
// The deploy workflow stamps VERSION with the commit SHA; a new SW installs a fresh
// shell cache atomically and the page offers a refresh.
const VERSION = 'gdb-3-__BUILD__';
const SHELL_CACHE = 'gdb-shell-' + VERSION;
const RUNTIME_CACHE = 'gdb-runtime-1';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'config.js',
  'css/app.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/audio.js',
  'js/board.js',
  'js/boardview.js',
  'js/data/default-packs.js',
  'js/fx.js',
  'js/game.js',
  'js/haptics.js',
  'js/invite.js',
  'js/libs.js',
  'js/main.js',
  'js/nav.js',
  'js/packs.js',
  'js/rng.js',
  'js/rules.js',
  'js/scoresview.js',
  'js/settings.js',
  'js/share.js',
  'js/sharecard.js',
  'js/store.js',
  'js/sync.js',
  'js/theme.js',
  'js/ui.js',
  'js/wakelock.js',
  'js/screens/create.js',
  'js/screens/final.js',
  'js/screens/games.js',
  'js/screens/home.js',
  'js/screens/join.js',
  'js/screens/lobby.js',
  'js/screens/onboard.js',
  'js/screens/pack-edit.js',
  'js/screens/packs.js',
  'js/screens/play.js',
  'js/screens/prefs.js',
];

// Cross-origin hosts worth keeping for offline: libraries and fonts.
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gdb-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && new URL(request.url).origin === self.location.origin) {
    const rt = await caches.open(RUNTIME_CACHE);
    rt.put(request, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await network;
  return res || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(
        caches.open(SHELL_CACHE)
          .then((c) => c.match('index.html'))
          .then((hit) => hit || fetch(request)),
      );
      return;
    }
    event.respondWith(
      fromShell(request).catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error()),
    );
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
