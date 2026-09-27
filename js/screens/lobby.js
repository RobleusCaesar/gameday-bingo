import { h, sheet, say, plural } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { openSession } from '../game.js';
import { invitePanel } from '../invite.js';
import { fill } from '../share.js';
import { cleanText } from '../packs.js';
import { syncConfigured } from '../sync.js';
import { normText } from '../board.js';

function swapSheet(session) {
  return sheet((close) => {
    const q = h('input', { class: 'input', type: 'search', placeholder: 'Search squares', 'aria-label': 'Search squares' });
    const list = h('ul', { class: 'list', style: { marginTop: '12px' } });
    const draw = () => {
      const needle = q.value.trim().toLowerCase();
      list.replaceChildren(...session.config.squares
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !needle || s.t.toLowerCase().includes(needle))
        .map(({ s, i }) => h('li', null, h('button', {
          class: 'sq-row',
          onclick: async () => {
            const next = await editOne(s);
            if (!next) return;
            const dupe = session.config.squares.some((x, k) => k !== i && normText(x.t) === normText(next.t));
            if (dupe) { say('That square is already in this game.', '⚠️'); return; }
            if (session.swapSquare(i, next)) say('Square swapped. Boards updated.', '🔁');
            else say('Too late: someone already marked a square.', '🔒');
            draw();
          },
        }, h('span', { class: 't' }, fill(s.t, session.config)), h('span', { class: 'chip chip-' + s.r }, s.r)))));
    };
    q.addEventListener('input', draw);
    draw();
    return h('div', null,
      h('h2', null, 'Swap a square'),
      h('p', { class: 'hint' }, 'You can change squares until anyone marks one. Everyone’s board updates.'),
      h('div', { style: { marginTop: '12px' } }, q),
      list,
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-ghost btn-block', onclick: () => close() }, 'Done')),
    );
  }, { label: 'Swap a square' });
}

function editOne(sq) {
  return sheet((close) => {
    let r = sq.r;
    const text = h('textarea', { class: 'input', maxlength: 80, 'aria-label': 'Square text', autofocus: true });
    text.value = sq.t;
    const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Rarity' });
    const drawSeg = () => seg.replaceChildren(...[['C', 'Common'], ['U', 'Uncommon'], ['R', 'Rare']].map(([k, label]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(k === r), onclick: () => { r = k; drawSeg(); },
    }, label)));
    drawSeg();
    return h('form', { onsubmit: (e) => { e.preventDefault(); const t = cleanText(text.value); close(t ? { t, r } : null); } },
      h('h2', null, 'Edit square'),
      h('div', { class: 'field' }, text),
      h('div', { class: 'field' }, seg),
      h('div', { class: 'actions-row' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close(null) }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Swap')),
    );
  }, { label: 'Edit square' });
}

export function render(app, code) {
  const session = openSession(code);
  if (!session) { go('/join/' + code, { replace: true }); return; }

  const who = h('div', { class: 'waiting', 'aria-live': 'polite' });
  const status = h('p', { class: 'hint center', style: { marginTop: '12px' } });
  const swapBtn = h('button', { class: 'btn btn-ghost btn-block', onclick: () => swapSheet(session) }, '🔁 Swap a square');

  const refresh = () => {
    const players = session.standings();
    who.replaceChildren(...players.map((p) => h('span', { class: 'chip' }, p.emoji + ' ' + (p.me ? p.name + ' (you)' : p.name))));
    const live = session.syncStatus === 'live';
    if (!syncConfigured()) status.textContent = 'Solo mode: live sync isn’t set up. Invite links still work.';
    else if (live) status.textContent = `${plural(session.onlineCount(), 'player')} here. More can join anytime.`;
    else status.textContent = 'Connecting… invite links work either way.';
    swapBtn.hidden = !session.canSwap();
  };

  app.append(h('main', { class: 'screen screen-enter' },
    pageHead('Invite friends', '/'),
    invitePanel(session),
    h('p', { class: 'section-title center' }, 'In the game'),
    who,
    status,
    h('div', { class: 'stack', style: { marginTop: '20px' } },
      h('button', { class: 'btn btn-paper btn-lg btn-block', onclick: () => go('/play/' + code, { replace: true }) }, '▶ Start playing'),
      swapBtn,
    ),
  ));
  refresh();
  const on = () => refresh();
  session.addEventListener('players', on);
  session.addEventListener('status', on);
  return () => {
    session.removeEventListener('players', on);
    session.removeEventListener('status', on);
  };
}
