// Navigation helpers shared by screens (kept apart from main.js to avoid import cycles).
import { h, icon } from './ui.js';

let pendingRoute = null;

export function go(path, { replace = false } = {}) {
  const hash = '#' + path;
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (replace) location.replace(hash); else location.hash = hash;
}

export function setPendingRoute(path) {
  pendingRoute = path;
}

/** Where to continue after onboarding (e.g. a join link opened on first launch). */
export function takePendingRoute() {
  const r = pendingRoute;
  pendingRoute = null;
  return r;
}

/** Standard page header with a back button. */
export function pageHead(title, backTo = '/', extra = null) {
  return h('header', { class: 'page-head' },
    h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => go(backTo) }, icon('back')),
    h('h1', null, title),
    extra,
  );
}
