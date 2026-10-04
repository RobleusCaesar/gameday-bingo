import { h } from '../ui.js';
import { go } from '../nav.js';
import { profile } from '../settings.js';
import { listGames } from '../game.js';
import * as store from '../store.js';
import { confirmSheet, say } from '../ui.js';
import { pendingMerges, mergeDefaults, dismissMerge } from '../packs.js';

/** One-time offer when a default pack the user edited has a newer version. */
async function offerMerges() {
  for (const p of pendingMerges()) {
    const ok = await confirmSheet({
      title: 'Default pack updated',
      body: `“${p.name}” has new squares (more likely calls, opponent and broadcast squares) and no longer includes player-injury squares. You’ve edited your copy. Merge the new squares in? Your own edits stay.`,
      ok: 'Merge new squares',
      cancel: 'Keep mine as is',
    });
    if (ok) {
      const res = mergeDefaults(p.id);
      if (res) say(`Added ${res.added} squares${res.removed ? `, removed ${res.removed}` : ''}`, '🆕');
    } else {
      dismissMerge(p.id);
    }
  }
}

const LIVE_WINDOW = 12 * 60 * 60 * 1000;

function bigButton({ cls, ico, label, sub, onclick }) {
  return h('button', { class: `btn btn-lg btn-block ${cls}`, onclick },
    h('span', { class: 'ico', 'aria-hidden': 'true' }, ico),
    h('span', { class: 'txt' }, label, h('span', { class: 'sub' }, sub)),
  );
}

function installHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (standalone || !ios || store.get('a2hsDismissed')) return null;
  const el = h('div', { class: 'install-hint', role: 'note' },
    h('span', { style: { fontSize: '22px' }, 'aria-hidden': 'true' }, '📲'),
    h('div', { class: 'grow' },
      h('strong', null, 'Add it to your Home Screen. '),
      'Tap the Share button ', h('span', { 'aria-label': 'share icon' }, '⎋'), ' in Safari, then “Add to Home Screen”. It opens full-screen and works offline.'),
    h('button', { class: 'icon-btn', 'aria-label': 'Dismiss install tip', onclick: () => { store.set('a2hsDismissed', true); el.remove(); } }, '✕'),
  );
  return el;
}

export function render(app) {
  const me = profile();
  const live = listGames().find((g) => g.status !== 'ended' && Date.now() - (g.config.createdAt || 0) < LIVE_WINDOW);

  const screen = h('main', { class: 'screen screen-home screen-enter' },
    h('header', { class: 'home-hero' },
      h('button', { class: 'profile-chip', 'aria-label': `Profile and settings: ${me.name}`, onclick: () => go('/settings') },
        h('span', { class: 'emoji', 'aria-hidden': 'true' }, me.emoji), h('span', null, me.name)),
      h('p', { class: 'kicker' }, 'Gameday'),
      h('h1', { class: 'wordmark distress' }, 'BINGO'),
      h('p', { class: 'tagline' }, 'Watch-party bingo. Everybody gets their own card.'),
    ),
    live ? h('button', { class: 'resume-card', onclick: () => go('/play/' + live.code) },
      h('span', { style: { fontSize: '26px' }, 'aria-hidden': 'true' }, '▶️'),
      h('span', { class: 'grow' },
        h('span', { class: 'label', style: { display: 'block', marginBottom: '4px' } }, 'Game in progress'),
        h('b', null, live.code), ' ',
        h('span', { class: 'hint' }, live.config.opp ? `vs ${live.config.opp}` : live.config.packName)),
      h('span', { class: 'chip chip-live' }, 'Resume'),
    ) : null,
    h('nav', { class: 'home-actions', 'aria-label': 'Main' },
      bigButton({ cls: 'btn-primary', ico: '🏈', label: 'Start a Game', sub: 'Host it and get a code', onclick: () => go('/create') }),
      bigButton({ cls: 'btn-paper', ico: '🔑', label: 'Join with Code', sub: 'Got a code or a link?', onclick: () => go('/join') }),
      bigButton({ cls: '', ico: '🗂️', label: 'My Games', sub: 'Resume or relive a game', onclick: () => go('/games') }),
      bigButton({ cls: '', ico: '✏️', label: 'Square Packs', sub: 'Edit what’s on the cards', onclick: () => go('/packs') }),
    ),
    installHint(),
    h('footer', { class: 'home-foot' },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => go('/settings') }, '⚙️ Settings'),
    ),
  );
  app.append(screen);
  if (pendingMerges().length) setTimeout(offerMerges, 400);
}
