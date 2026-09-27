import { h, confirmSheet, fmtDate, plural } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { listGames, deleteGame } from '../game.js';
import { evaluate, compareStandings } from '../rules.js';
import { profile } from '../settings.js';

function myLine(g) {
  const ev = evaluate(g.board, g.marks, g.config.win);
  if (g.status === 'ended' && g.final?.length) {
    const me = profile().id;
    const sorted = g.final.slice().sort(compareStandings);
    const rank = sorted.findIndex((p) => p.pid === me) + 1;
    return `${ev.points} pts · ${plural(ev.bingos, 'bingo')}${rank ? ` · #${rank} of ${sorted.length}` : ''}`;
  }
  return `${ev.points} pts · ${plural(ev.bingos, 'bingo')}`;
}

export function render(app) {
  const list = h('ul', { class: 'list' });
  const draw = () => {
    const games = listGames();
    if (!games.length) {
      list.replaceChildren(h('li', { class: 'empty' },
        h('p', { style: { fontSize: '40px' } }, '🗂️'),
        h('p', null, 'No games yet. Start one or join a friend’s.'),
        h('p', { style: { marginTop: '14px' } }, h('button', { class: 'btn btn-primary', onclick: () => go('/create') }, 'Start a Game'))));
      return;
    }
    list.replaceChildren(...games.map((g) => {
      const ended = g.status === 'ended';
      return h('li', { class: 'card game-row' },
        h('button', {
          class: 'pack-open',
          onclick: () => go((ended ? '/final/' : '/play/') + g.code),
          'aria-label': `Game ${g.code}${g.config.opp ? ' versus ' + g.config.opp : ''}, ${ended ? 'final' : 'in progress'}`,
        },
        h('span', { class: 'row' },
          h('span', { class: 'code' }, g.code),
          h('span', { class: 'chip ' + (ended ? 'chip-final' : 'chip-live') }, ended ? 'FINAL' : 'LIVE'),
          h('small', { class: 'hint' }, fmtDate(g.config.createdAt || g.createdAt))),
        h('span', { style: { display: 'block', fontWeight: '800', marginTop: '4px' } }, g.config.opp ? `vs ${g.config.opp}` : g.config.packName),
        h('small', { class: 'hint' }, myLine(g))),
        h('button', {
          class: 'icon-btn', 'aria-label': `Delete game ${g.code}`,
          onclick: async () => {
            if (await confirmSheet({ title: `Delete game ${g.code}?`, body: 'Removes it from this device only.', ok: 'Delete', danger: true })) {
              deleteGame(g.code);
              draw();
            }
          },
        }, '🗑️'));
    }));
  };
  draw();
  app.append(h('main', { class: 'screen screen-enter' }, pageHead('My Games', '/'), list));
}
