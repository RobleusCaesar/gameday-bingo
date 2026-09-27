// Boot + hash router. Screens are lazy-loaded ES modules exporting render(app, ...params).
import { applyTheme, watchMotionPreference } from './theme.js';
import { hasProfile, onSettings } from './settings.js';
import { closeAllSheets, h, toast } from './ui.js';
import { go, setPendingRoute } from './nav.js';

const routes = [
  [/^\/?$/, () => import('./screens/home.js')],
  [/^\/onboard$/, () => import('./screens/onboard.js')],
  [/^\/create$/, () => import('./screens/create.js')],
  [/^\/lobby\/([A-Z0-9]{5})$/, () => import('./screens/lobby.js')],
  [/^\/join(?:\/(.+))?$/, () => import('./screens/join.js')],
  [/^\/play\/([A-Z0-9]{5})$/, () => import('./screens/play.js')],
  [/^\/final\/([A-Z0-9]{5})$/, () => import('./screens/final.js')],
  [/^\/games$/, () => import('./screens/games.js')],
  [/^\/packs$/, () => import('./screens/packs.js')],
  [/^\/packs\/([\w-]+)$/, () => import('./screens/pack-edit.js')],
  [/^\/settings$/, () => import('./screens/prefs.js')],
];

let cleanup = null;
let token = 0;

async function render() {
  const my = ++token;
  let path = location.hash.replace(/^#/, '') || '/';
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  if (!hasProfile() && path !== '/onboard') {
    setPendingRoute(path === '/' ? null : path);
    go('/onboard', { replace: true });
    return;
  }
  let match = null;
  let load = routes[0][1];
  for (const [re, loader] of routes) {
    match = re.exec(path);
    if (match) { load = loader; break; }
  }
  let mod;
  try {
    mod = await load();
  } catch (err) {
    if (my !== token) return;
    console.error(err);
    showLoadError();
    return;
  }
  if (my !== token) return;
  closeAllSheets();
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  const app = document.getElementById('app');
  app.replaceChildren();
  const params = match ? match.slice(1) : [];
  const res = mod.render(app, ...params);
  cleanup = typeof res === 'function' ? res : null;
  window.scrollTo(0, 0);
}

function showLoadError() {
  const app = document.getElementById('app');
  app.replaceChildren(h('main', { class: 'screen' },
    h('div', { class: 'empty' },
      h('p', { style: { fontSize: '40px' } }, '📡'),
      h('p', null, 'Couldn’t load that screen. Check your connection and try again.'),
      h('p', { style: { marginTop: '16px' } }, h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Reload')),
    )));
}

/* ---------- Boot ---------- */

applyTheme();
watchMotionPreference();
onSettings(applyTheme);
window.addEventListener('hashchange', render);
render();

// iOS only applies :active styles when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

// Unlock Web Audio on the first real gesture (iOS requirement).
const unlock = () => {
  import('./audio.js').then((a) => a.unlockAudio());
  for (const ev of ['pointerdown', 'touchend', 'keydown']) document.removeEventListener(ev, unlock, true);
};
for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, unlock, true);

window.addEventListener('load', () => {
  import('./libs.js').then((l) => l.prefetchLibs());
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      toast({ tag: '✨', title: 'Update ready', sub: 'Refresh to get the latest version.', action: 'Refresh', onAction: () => location.reload(), duration: 0 });
    });
  }
});
