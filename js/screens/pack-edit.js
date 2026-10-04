import { h, sheet, say, plural, setChildren } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { getPack, savePack, stats, categories, lockedBy, duplicatePack, cleanText } from '../packs.js';
import { shortId } from '../rng.js';
import { normText, MIN_SQUARES, WARN_SQUARES } from '../board.js';
import { meter } from './packs.js';
import { BROADCASTS, broadcastLabel, parseTeams } from '../tags.js';

/** Chips for a square's tags: "vs 49ers", "SNF". */
function tagChips(sq) {
  return [
    ...(sq.opponents || []).map((o) => h('span', { class: 'chip tag-chip' }, 'vs ' + o)),
    ...(sq.broadcasts || []).map((b) => h('span', { class: 'chip tag-chip' }, broadcastLabel(b))),
  ];
}

const RARITIES = [['C', 'Common', '1 pt'], ['U', 'Uncommon', '2 pts'], ['R', 'Rare', '3 pts']];

function raritySeg(value, onChange) {
  const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Rarity' });
  const draw = () => seg.replaceChildren(...RARITIES.map(([k, label, pts]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(k === value),
    onclick: () => { value = k; onChange(k); draw(); },
  }, label, h('small', { style: { display: 'block', fontWeight: 600, fontSize: '11px' } }, pts))));
  draw();
  return seg;
}

function categoryField(pack, value, onChange, id) {
  const opts = categories(pack);
  const sel = h('select', { class: 'input', id },
    h('option', { value: '' }, 'No category'),
    ...opts.map((c) => h('option', { value: c, selected: c === value }, c)),
    h('option', { value: '__new' }, '+ New category…'));
  const custom = h('input', { class: 'input', maxlength: 20, placeholder: 'Category name', hidden: true, 'aria-label': 'New category name' });
  sel.addEventListener('change', () => {
    custom.hidden = sel.value !== '__new';
    if (sel.value === '__new') custom.focus(); else onChange(sel.value);
  });
  custom.addEventListener('input', () => onChange(custom.value.trim().slice(0, 20)));
  return h('div', { class: 'stack' }, sel, custom);
}

/** Bottom-sheet editor for one square. Resolves {t,r,c}, 'delete', or undefined. */
function editSquare(pack, sq) {
  return sheet((close) => {
    let r = sq?.r || 'C';
    let c = sq?.c || '';
    const opps = h('input', { class: 'input', id: 'sq-opp', maxlength: 80, placeholder: 'Any opponent', value: (sq?.opponents || []).join(', ') });
    const bc = h('select', { class: 'input', id: 'sq-bc' },
      h('option', { value: '' }, 'Any broadcast'),
      ...BROADCASTS.map((b) => h('option', { value: b.id, selected: (sq?.broadcasts || [])[0] === b.id }, b.label)));
    const text = h('textarea', { class: 'input', id: 'sq-text', maxlength: 80, autofocus: true, placeholder: 'e.g. Sad {OPP} fan shown' });
    text.value = sq?.t || '';
    const err = h('p', { class: 'hint', role: 'alert', style: { color: 'var(--danger)' } });
    return h('form', {
      onsubmit: (e) => {
        e.preventDefault();
        const t = cleanText(text.value);
        if (!t) { err.textContent = 'Type what has to happen.'; return; }
        const dupe = pack.squares.find((x) => x !== sq && normText(x.t) === normText(t));
        if (dupe) { err.textContent = 'That square is already in the pack.'; return; }
        const opponents = parseTeams(opps.value);
        close({ t, r, c, opponents: opponents.length ? opponents : undefined, broadcasts: bc.value ? [bc.value] : undefined });
      },
    },
    h('h2', null, sq ? 'Edit square' : 'Add square'),
    h('div', { class: 'field' }, h('label', { for: 'sq-text' }, 'Square text'), text,
      h('p', { class: 'hint' }, 'Use {OPP} for the opponent and {TEAM} for your team.')),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Rarity'), raritySeg(r, (v) => { r = v; })),
    h('div', { class: 'field' }, h('label', { for: 'sq-cat' }, 'Category'), categoryField(pack, c, (v) => { c = v; }, 'sq-cat')),
    h('div', { class: 'field' }, h('label', { for: 'sq-opp' }, 'Only when playing'), opps,
      h('p', { class: 'hint' }, 'Team names, comma-separated. Leave blank for every game. Nicknames work: Niners = 49ers.')),
    h('div', { class: 'field' }, h('label', { for: 'sq-bc' }, 'Only on'), bc),
    err,
    h('div', { class: 'actions-row' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, sq ? 'Save' : 'Add')),
    sq ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-danger btn-block', onclick: () => close('delete') }, 'Delete square')) : null,
    );
  }, { label: sq ? 'Edit square' : 'Add square' });
}

function bulkAdd(pack) {
  return sheet((close) => {
    let r = 'C';
    let c = '';
    const ta = h('textarea', { class: 'input', id: 'bulk', autofocus: true, rows: 8, placeholder: 'One square per line\nFumble\nSad {OPP} fan shown\nPick six' });
    return h('form', {
      onsubmit: (e) => {
        e.preventDefault();
        const lines = ta.value.split(/\r?\n/).map(cleanText).filter(Boolean);
        close({ lines, r, c });
      },
    },
    h('h2', null, 'Bulk add'),
    h('div', { class: 'field' }, h('label', { for: 'bulk' }, 'Paste one square per line'), ta),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Rarity for all'), raritySeg(r, (v) => { r = v; })),
    h('div', { class: 'field' }, h('label', { for: 'bulk-cat' }, 'Category for all'), categoryField(pack, c, (v) => { c = v; }, 'bulk-cat')),
    h('div', { class: 'actions-row' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add all')),
    );
  }, { label: 'Bulk add' });
}

export function render(app, id) {
  const pack = getPack(id);
  if (!pack) { go('/packs', { replace: true }); return; }
  const lock = lockedBy(pack.id);
  let query = '';

  const summary = h('div', { class: 'card', style: { marginBottom: '14px' } });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search squares', 'aria-label': 'Search squares', enterkeyhint: 'search' });
  const list = h('ul', { class: 'list', style: { marginTop: '12px', paddingBottom: '90px' } });

  const drawSummary = () => {
    const s = stats(pack);
    setChildren(summary,
      h('div', { class: 'row-between' },
        h('b', { style: { fontSize: '18px' } }, plural(s.total, 'square')),
        h('span', { class: 'row', style: { gap: '6px' } },
          h('span', { class: 'chip chip-C' }, `C ${s.counts.C}`), h('span', { class: 'chip chip-U' }, `U ${s.counts.U}`), h('span', { class: 'chip chip-R' }, `R ${s.counts.R}`))),
      h('div', { style: { marginTop: '10px' } }, meter(s.strength)),
      s.total < MIN_SQUARES
        ? h('p', { class: 'hint', style: { color: 'var(--danger)', marginTop: '8px' } }, `Add ${MIN_SQUARES - s.total} more to start a game (needs ${MIN_SQUARES}).`)
        : s.total < WARN_SQUARES
          ? h('p', { class: 'hint', style: { color: 'var(--gold)', marginTop: '8px' } }, `Under ${WARN_SQUARES} squares: boards will look alike.`)
          : null,
    );
  };

  const drawList = () => {
    const q = query.trim().toLowerCase();
    const rows = pack.squares
      .filter((sq) => !q || [sq.t, sq.c, ...(sq.opponents || []), ...(sq.broadcasts || [])].join(' ').toLowerCase().includes(q))
      .map((sq) => h('li', null, h('button', { class: 'sq-row', onclick: () => edit(sq) },
        h('span', { class: 't' }, sq.t),
        ...tagChips(sq),
        sq.c ? h('span', { class: 'chip cat-chip' }, sq.c) : null,
        h('span', { class: 'chip chip-' + sq.r }, h('span', { 'aria-hidden': 'true' }, sq.r),
          h('span', { class: 'sr-only' }, RARITIES.find(([k]) => k === sq.r)[1])))));
    list.replaceChildren(...(rows.length ? rows : [h('li', { class: 'empty' }, q ? 'No squares match.' : 'No squares yet. Tap + Add, or paste a list with Bulk add.')]));
  };

  const persist = () => { savePack(pack); drawSummary(); drawList(); };

  async function edit(sq) {
    if (lock) { say(`Locked while game ${lock} is live. Duplicate it to edit.`, '🔒'); return; }
    const res = await editSquare(pack, sq);
    if (!res) return;
    if (res === 'delete') {
      pack.squares = pack.squares.filter((x) => x !== sq);
    } else if (sq) {
      Object.assign(sq, res);
      if (!res.opponents) delete sq.opponents;
      if (!res.broadcasts) delete sq.broadcasts;
    } else {
      const fresh = { id: shortId(), ...res };
      if (!fresh.opponents) delete fresh.opponents;
      if (!fresh.broadcasts) delete fresh.broadcasts;
      pack.squares.unshift(fresh);
    }
    persist();
  }

  async function bulk() {
    const res = await bulkAdd(pack);
    if (!res || !res.lines.length) return;
    const seen = new Set(pack.squares.map((x) => normText(x.t)));
    let added = 0;
    for (const t of res.lines) {
      if (seen.has(normText(t))) continue;
      seen.add(normText(t));
      pack.squares.push({ id: shortId(), t, r: res.r, c: res.c });
      added++;
    }
    persist();
    const skipped = res.lines.length - added;
    say(`Added ${plural(added, 'square')}${skipped ? ` (${skipped} already there)` : ''}`, '➕');
  }

  search.addEventListener('input', () => { query = search.value; drawList(); });

  const title = pageHead(pack.name, '/packs');
  const toolbar = lock ? null : h('div', { class: 'row', style: { marginTop: '12px' } },
    h('button', { class: 'btn btn-ghost btn-sm grow', onclick: bulk }, '📋 Bulk add'),
  );
  const lockNote = lock ? h('div', { class: 'lock-note' },
    h('span', { style: { fontSize: '22px' }, 'aria-hidden': 'true' }, '🔒'),
    h('div', { class: 'grow' }, h('b', null, 'Locked'), h('p', { class: 'hint' }, `Game ${lock} is using this pack. Duplicate it to make changes.`)),
    h('button', { class: 'btn btn-sm btn-gold', onclick: () => { const d = duplicatePack(pack.id); go('/packs/' + d.id, { replace: true }); } }, 'Duplicate')) : null;
  const fab = lock ? null : h('button', { class: 'btn btn-primary fab', onclick: () => edit(null) }, '+ Add');

  app.append(h('main', { class: 'screen screen-enter' }, title, lockNote, summary, search, toolbar, list, fab));
  drawSummary();
  drawList();
}
