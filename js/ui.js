// DOM helpers, sheets, toasts, banners. All remote text goes through textContent.

export function h(tag, attrs = null, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v; // trusted, static markup only
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** replaceChildren that skips null/false (like h()). */
export function setChildren(el, ...kids) {
  el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// Minimal inline icons (static strings).
export const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.4l2.6 2.6L12 5.4"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6l12.6 28.4 30.9 3.2-23.1 20.8 6.6 30.4L50 73.3 23 88.8l6.6-30.4L6.5 37.6l30.9-3.2z" fill="#111" /><path d="M50 18l9 20.3 22.1 2.3-16.5 14.8 4.7 21.7L50 66 30.7 77.1l4.7-21.7L18.9 40.6 41 38.3z" fill="var(--gold)"/></svg>',
};

export function icon(name) {
  return h('span', { 'aria-hidden': 'true', class: 'i', style: { display: 'inline-grid' }, html: ICON[name] });
}

let layerEl;
export function layer() {
  layerEl ||= document.getElementById('layer');
  return layerEl;
}

/* ---------- Sheets ---------- */

let openSheets = [];

/**
 * Open a bottom sheet. `build(close)` returns the content node.
 * Resolves with whatever value close() is called with.
 */
export function sheet(build, { label = 'Dialog', dismissable = true } = {}) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const backdrop = h('div', { class: 'backdrop' });
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' },
      h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }));
    let done = false;
    const close = (value) => {
      if (done) return;
      done = true;
      openSheets = openSheets.filter((s) => s !== entry);
      panel.classList.add('out');
      backdrop.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { panel.remove(); backdrop.remove(); }, 200);
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable && openSheets[openSheets.length - 1] === entry) close(undefined);
    };
    const entry = { close };
    openSheets.push(entry);
    if (dismissable) backdrop.addEventListener('click', () => close(undefined));
    panel.append(build(close));
    layer().append(backdrop, panel);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      const first = panel.querySelector('[autofocus]');
      (first || panel).focus({ preventScroll: true });
    });
  });
}

export function closeAllSheets() {
  for (const s of openSheets.slice()) s.close(undefined);
}

export function confirmSheet({ title, body, ok = 'OK', cancel = 'Cancel', danger = false }) {
  return sheet((close) => h('div', null,
    h('h2', null, title),
    body ? h('p', { class: 'hint', style: { fontSize: '16px' } }, body) : null,
    h('div', { class: 'actions' },
      h('button', { class: `btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => close(true) }, ok),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => close(false) }, cancel),
    ),
  ), { label: title }).then(Boolean);
}

export function promptSheet({ title, label, value = '', ok = 'Save', max = 40 }) {
  return sheet((close) => {
    const input = h('input', { class: 'input', value, maxlength: max, autofocus: true, 'aria-label': label || title });
    const form = h('form', { onsubmit: (e) => { e.preventDefault(); close(input.value.trim() || null); } },
      h('h2', null, title),
      h('div', { class: 'field' }, label ? h('label', null, label) : null, input),
      h('div', { class: 'actions-row' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close(null) }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, ok),
      ),
    );
    return form;
  }, { label: title });
}

/* ---------- Toasts ---------- */

let toastWrap;
function toasts() {
  if (!toastWrap || !toastWrap.isConnected) {
    toastWrap = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    layer().append(toastWrap);
  }
  return toastWrap;
}

/**
 * Broadcast lower-third toast.
 * @returns {{close:Function, el:HTMLElement}}
 */
export function toast({ tag = '📣', title, sub, action, onAction, duration = 3200, gold = false, key } = {}) {
  const wrap = toasts();
  if (key) wrap.querySelector(`[data-key="${CSS.escape(key)}"]`)?.remove();
  while (wrap.children.length >= 3) wrap.firstChild.remove();
  const el = h('div', { class: 'toast' + (gold ? ' gold' : ''), dataset: key ? { key } : null });
  let timer;
  const close = () => {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  };
  const body = h('div', { class: 'toast-body' });
  if (title instanceof Node) body.append(title); else body.append(h('b', null, title || ''));
  if (sub) body.append(h('small', null, sub));
  el.append(h('div', { class: 'toast-tag', 'aria-hidden': 'true' }, tag), body);
  const act = h('div', { class: 'toast-act' });
  if (action) {
    act.append(h('button', { class: 'btn btn-primary btn-sm', onclick: () => { close(); onAction?.(); } }, action));
  }
  act.append(h('button', { class: 'icon-btn x', 'aria-label': 'Dismiss', onclick: close, html: ICON.close }));
  el.append(act);
  if (duration) {
    const bar = h('div', { class: 'toast-timer', 'aria-hidden': 'true' });
    el.append(bar);
    bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration, easing: 'linear', fill: 'forwards' });
    timer = setTimeout(close, duration);
  }
  wrap.append(el);
  return { close, el };
}

export function say(text, tag = '✅') {
  return toast({ tag, title: text, duration: 2200 });
}

/* ---------- Banner ---------- */

export function banner(text, emoji = '🎉', ms = 2600) {
  const el = h('div', { class: 'banner', role: 'status' }, h('span', { class: 'e', 'aria-hidden': 'true' }, emoji), h('span', null, text));
  layer().querySelectorAll('.banner').forEach((b) => b.remove());
  layer().append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
  return el;
}

/* ---------- Share / copy ---------- */

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

/** navigator.share with copy fallback. Returns 'shared' | 'copied' | 'cancelled' | 'failed'. */
export async function shareOrCopy({ title, text, url, files }) {
  const data = { title, text, url };
  if (files && navigator.canShare && navigator.canShare({ files })) data.files = files;
  if (navigator.share && (!files || data.files || !navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const ok = await copyText([text, url].filter(Boolean).join('\n'));
  return ok ? 'copied' : 'failed';
}

export function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm';
  const hr = Math.round(m / 60);
  if (hr < 24) return hr + 'h';
  return Math.round(hr / 24) + 'd';
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}
