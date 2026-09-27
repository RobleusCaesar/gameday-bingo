import { h, say } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { CODE_ALPHABET } from '../rng.js';
import { parseJoin, decodePayload } from '../share.js';
import { hasGame, joinGame } from '../game.js';
import { requestConfig, syncConfigured } from '../sync.js';
import { profile } from '../settings.js';

const ALLOWED = new Set(CODE_ALPHABET);

export function render(app, arg) {
  const initial = arg ? parseJoin('#/join/' + arg) : null;
  let busy = false;

  const input = h('input', {
    id: 'j-code', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off',
    spellcheck: 'false', enterkeyhint: 'go', 'aria-label': 'Game code, 5 characters', maxlength: 400,
  });
  const boxes = h('div', { class: 'code-boxes', 'aria-hidden': 'true' }, ...Array.from({ length: 5 }, () => h('span')));
  const entry = h('div', { class: 'code-entry' }, boxes, input);
  const msg = h('p', { class: 'hint center', role: 'status', style: { minHeight: '44px', marginTop: '10px' } });
  const btn = h('button', { type: 'submit', class: 'btn btn-primary btn-lg btn-block', disabled: true }, 'Join game');

  const value = () => input.value.toUpperCase().split('').filter((c) => ALLOWED.has(c)).join('').slice(0, 5);

  const paint = () => {
    const v = value();
    [...boxes.children].forEach((b, i) => {
      b.textContent = v[i] || '';
      b.classList.toggle('filled', !!v[i]);
      b.classList.toggle('cursor', i === Math.min(v.length, 4) && v.length < 5);
    });
    btn.disabled = v.length !== 5 || busy;
  };

  const bad = (text) => {
    msg.textContent = text;
    entry.classList.remove('bad');
    void entry.offsetWidth;
    entry.classList.add('bad');
  };

  input.addEventListener('input', () => {
    const raw = input.value;
    // A pasted invite link: take the code and payload straight from it.
    if (raw.length > 5 && raw.includes('/join/')) {
      const parsed = parseJoin(raw);
      if (parsed) { input.value = parsed.code; paint(); attempt(parsed); return; }
    }
    const clean = value();
    if (raw.toUpperCase() !== clean && raw.length <= 5) {
      const dropped = raw.toUpperCase().split('').find((c) => !ALLOWED.has(c));
      if (dropped && /[01ILO]/.test(dropped)) bad('Codes never use 0, 1, I, L or O.');
    }
    input.value = clean;
    paint();
    if (clean.length === 5) attempt({ code: clean, payload: null });
  });
  input.addEventListener('focus', () => entry.classList.add('focused'));
  input.addEventListener('blur', () => entry.classList.remove('focused'));

  async function attempt({ code, payload }) {
    if (busy) return;
    if (hasGame(code) && !payload) { go('/play/' + code, { replace: true }); return; }
    busy = true;
    paint();
    try {
      let cfg = null;
      if (payload) {
        msg.textContent = 'Reading invite…';
        try { cfg = await decodePayload(code, payload); } catch { cfg = null; }
        if (!cfg) msg.textContent = 'That link looks damaged. Trying the code instead…';
      }
      if (!cfg) {
        if (!syncConfigured()) {
          bad('Live games aren’t set up here yet. Ask for the invite link instead. It works without a connection.');
          return;
        }
        if (navigator.onLine === false) {
          bad('You’re offline. Ask for the invite link instead. It works without a connection.');
          return;
        }
        msg.textContent = `Finding game ${code}…`;
        cfg = await requestConfig(code, { key: profile().id + '-join' });
        if (!cfg) {
          bad(`Couldn’t find game ${code}. Check the code, or ask for the invite link.`);
          return;
        }
      }
      const session = joinGame(cfg);
      if (!session) { bad('That game didn’t come through right. Ask for a fresh invite link.'); return; }
      say(`You’re in! Game ${code}`, '🎉');
      go('/play/' + code, { replace: true });
    } finally {
      busy = false;
      paint();
    }
  }

  const form = h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const v = value();
      if (v.length === 5) attempt({ code: v, payload: null });
    },
  },
  h('p', { class: 'center', style: { fontSize: '17px' } }, 'Enter the 5-character code from the host’s screen.'),
  entry,
  msg,
  btn,
  );

  app.append(h('main', { class: 'screen screen-enter' }, pageHead('Join a Game', '/'), form));
  paint();

  if (initial) {
    input.value = initial.code;
    paint();
    attempt(initial);
  } else {
    requestAnimationFrame(() => input.focus());
  }
}
