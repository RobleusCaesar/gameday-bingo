import { h, say } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { listPacks, stats, usesTeamToken } from '../packs.js';
import { createGame } from '../game.js';
import { MIX_LABELS } from '../board.js';
import * as store from '../store.js';

const MIX_NOTES = {
  chill: 'Mostly common squares. Bingos come quick.',
  balanced: 'A good mix. The default.',
  chaos: 'Loaded with rares. Big swings.',
};

function toggleRow({ label, sub, checked, disabled, onChange }) {
  const sw = h('button', {
    type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(checked), disabled, 'aria-label': label,
    onclick: () => {
      checked = !checked;
      sw.setAttribute('aria-checked', String(checked));
      onChange?.(checked);
    },
  });
  return h('div', { class: 'set-row' },
    h('div', { class: 'l' }, h('b', null, label), sub ? h('small', null, sub) : null), sw);
}

export function render(app) {
  const last = store.get('lastCreate') || {};
  const packs = listPacks();
  let packId = packs.some((p) => p.id === last.packId) ? last.packId : (packs.find((p) => p.id === 'broncos') || packs[0])?.id;
  const win = { corners: !!last.win?.corners, x: !!last.win?.x, blackout: !!last.win?.blackout };
  let mix = last.mix || 'balanced';

  const packSel = h('select', { class: 'input', id: 'c-pack' });
  const packNote = h('p', { class: 'hint' });
  const opp = h('input', { class: 'input', id: 'c-opp', maxlength: 30, placeholder: 'e.g. Chiefs', value: last.opp || '', autocapitalize: 'words', enterkeyhint: 'next' });
  const team = h('input', { class: 'input', id: 'c-team', maxlength: 30, placeholder: 'e.g. Broncos', value: last.team || '', autocapitalize: 'words' });
  const teamField = h('div', { class: 'field' }, h('label', { for: 'c-team' }, 'Your team'), team);
  const createBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-lg btn-block' }, 'Create game');

  for (const p of packs) {
    const s = stats(p);
    packSel.append(h('option', { value: p.id, selected: p.id === packId }, `${p.name} (${s.total})`));
  }

  const refreshPack = () => {
    const pack = packs.find((p) => p.id === packSel.value);
    packId = pack?.id;
    const s = pack ? stats(pack) : null;
    teamField.hidden = !pack || !usesTeamToken(pack);
    if (!s) return;
    if (!s.canCreate) {
      packNote.textContent = `This pack only has ${s.total} squares. Games need at least 24.`;
      packNote.style.color = 'var(--danger)';
    } else if (s.warn) {
      packNote.textContent = `Only ${s.total} squares, so boards will look alike. Add more in Square Packs.`;
      packNote.style.color = 'var(--gold)';
    } else {
      packNote.textContent = '';
    }
    packName.textContent = pack.name;
    createBtn.disabled = !s.canCreate;
  };
  packSel.addEventListener('change', refreshPack);

  // Most people never need this: every card is drawn from the default Broncos squares.
  // Anyone who has made their own list in Square Packs can switch here.
  const packName = h('b');
  const packField = h('div', { class: 'field', hidden: true },
    h('label', { for: 'c-pack' }, 'Which squares?'), packSel,
    h('p', { class: 'hint' }, 'The list of things everyone’s card is drawn from. Edit lists in Square Packs.'));
  const packLine = h('p', { class: 'hint', style: { marginBottom: '18px' } },
    'Squares: ', packName, ' · ',
    h('button', {
      type: 'button', class: 'linkish',
      onclick: () => { packField.hidden = false; packLine.hidden = true; packSel.focus(); },
    }, 'Change'));

  const mixNote = h('p', { class: 'hint', style: { marginTop: '8px' } }, MIX_NOTES[mix]);
  const mixSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Board mix' });
  const renderMix = () => {
    mixSeg.replaceChildren(...Object.keys(MIX_LABELS).map((m) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(m === mix),
      onclick: () => { mix = m; mixNote.textContent = MIX_NOTES[m]; renderMix(); },
    }, MIX_LABELS[m])));
  };
  renderMix();

  const form = h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const pack = packs.find((p) => p.id === packId);
      if (!pack || !stats(pack).canCreate) return;
      store.set('lastCreate', { packId, opp: opp.value.trim(), team: team.value.trim(), win, mix });
      try {
        const s = createGame({ pack, opp: opp.value, team: team.value, win, mix });
        go('/lobby/' + s.code, { replace: true });
      } catch (err) {
        console.error(err);
        say('Couldn’t create the game: ' + err.message, '⚠️');
      }
    },
  },
  h('div', { class: 'field' }, h('label', { for: 'c-opp' }, 'Opponent'), opp),
  teamField,
  h('div', { class: 'field' },
    h('span', { class: 'label' }, 'Ways to win'),
    h('div', null,
      toggleRow({ label: 'Line', sub: 'Row, column or diagonal · +10', checked: true, disabled: true }),
      toggleRow({ label: 'Four Corners', sub: '+10 bonus', checked: win.corners, onChange: (v) => { win.corners = v; } }),
      toggleRow({ label: 'X', sub: 'Both diagonals · +20 bonus', checked: win.x, onChange: (v) => { win.x = v; } }),
      toggleRow({ label: 'Blackout', sub: 'Every square · +50 bonus', checked: win.blackout, onChange: (v) => { win.blackout = v; } }),
    ),
  ),
  h('div', { class: 'field' }, h('span', { class: 'label' }, 'Board mix'), mixSeg, mixNote),
  packLine,
  packField,
  packNote,
  createBtn,
  );

  app.append(h('main', { class: 'screen screen-enter' }, pageHead('Start a Game', '/'), form));
  refreshPack();
}
