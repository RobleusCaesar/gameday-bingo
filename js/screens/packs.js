import { h, sheet, confirmSheet, promptSheet, say } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { listPacks, stats, duplicatePack, renamePack, deletePack, resetPack, createPack, lockedBy } from '../packs.js';

const STRENGTH = { low: 'Low', good: 'Good', great: 'Great' };

export function meter(level) {
  return h('span', { class: 'meter', dataset: { level } },
    h('span', { class: 'meter-bar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('span', { class: 'hint' }, 'Unique-board strength: ', h('b', null, STRENGTH[level])));
}

export function render(app) {
  const list = h('ul', { class: 'list' });

  const draw = () => {
    const packs = listPacks();
    list.replaceChildren(...packs.map((p) => {
      const s = stats(p);
      const lock = lockedBy(p.id);
      return h('li', { class: 'card' },
        h('div', { class: 'pack-card' },
          h('button', { class: 'pack-open', onclick: () => go('/packs/' + p.id) },
            h('span', { class: 'grow' },
              h('b', null, p.name),
              h('small', null, `${s.total} squares · C ${s.counts.C} · U ${s.counts.U} · R ${s.counts.R}`),
              lock ? h('small', { style: { display: 'block', color: 'var(--gold)' } }, `🔒 In use by game ${lock}`) : null)),
          h('button', { class: 'icon-btn', 'aria-label': `More options for ${p.name}`, onclick: () => actions(p) }, '⋯')),
        h('div', { style: { marginTop: '10px' } }, meter(s.strength)),
        !s.canCreate ? h('p', { class: 'hint', style: { color: 'var(--danger)', marginTop: '6px' } }, 'Needs at least 24 squares to start a game.') : null,
      );
    }));
  };

  async function actions(p) {
    const choice = await sheet((close) => h('div', null,
      h('h2', null, p.name),
      h('div', { class: 'menu-list' },
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => close('open') }, '✏️ Edit squares'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => close('dup') }, '📄 Duplicate'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => close('rename') }, '🏷️ Rename'),
        p.builtin ? h('button', { class: 'btn btn-ghost btn-block', onclick: () => close('reset') }, '↩️ Reset to default') : null,
        h('button', { class: 'btn btn-danger btn-block', onclick: () => close('delete') }, '🗑️ Delete'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => close() }, 'Cancel'))),
    { label: p.name });
    const lock = lockedBy(p.id);
    if (choice === 'open') go('/packs/' + p.id);
    if (choice === 'dup') { const d = duplicatePack(p.id); say(`Made “${d.name}”`, '📄'); draw(); }
    if (choice === 'rename') {
      const name = await promptSheet({ title: 'Rename pack', label: 'Pack name', value: p.name, max: 40 });
      if (name) { renamePack(p.id, name); draw(); }
    }
    if (choice === 'reset') {
      if (lock) { say(`Locked while game ${lock} is live`, '🔒'); return; }
      if (await confirmSheet({ title: 'Reset to default?', body: 'Your edits to this pack will be replaced with the original squares.', ok: 'Reset', danger: true })) {
        resetPack(p.id); say('Pack reset', '↩️'); draw();
      }
    }
    if (choice === 'delete') {
      if (lock) { say(`Locked while game ${lock} is live`, '🔒'); return; }
      if (await confirmSheet({ title: `Delete “${p.name}”?`, body: 'Games already started keep their squares.', ok: 'Delete', danger: true })) {
        deletePack(p.id); draw();
      }
    }
  }

  const add = h('button', {
    class: 'btn btn-primary btn-block',
    onclick: async () => {
      const name = await promptSheet({ title: 'New pack', label: 'Pack name', value: '', ok: 'Create', max: 40 });
      if (name) go('/packs/' + createPack(name).id);
    },
  }, '+ New pack');

  draw();
  app.append(h('main', { class: 'screen screen-enter' },
    pageHead('Square Packs', '/'),
    h('p', { class: 'hint', style: { marginBottom: '14px' } }, 'Every player’s card is drawn from the pack. Bigger packs make more unique boards.'),
    list,
    h('div', { style: { marginTop: '16px' } }, add),
  ));
}
