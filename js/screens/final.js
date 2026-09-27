import { h, plural } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { openSession } from '../game.js';
import { heatMap } from '../scoresview.js';
import { bingoKeys, cellsForKey, evaluate, CENTER } from '../rules.js';
import { confettiBig } from '../fx.js';
import { settings } from '../settings.js';

export function miniBoard(session) {
  const ev = evaluate(session.board, session.marks, session.config.win);
  const won = new Set();
  for (const k of bingoKeys(ev)) for (const i of cellsForKey(k)) won.add(i);
  return h('div', { class: 'mini-board', role: 'img', 'aria-label': `Your card: ${session.markCount} squares marked, ${plural(ev.bingos, 'bingo')}` },
    ...session.board.map((sq, i) => h('i', { class: (session.marks[i] ? 'on' : '') + (won.has(i) ? ' win' : ''), 'aria-hidden': 'true' },
      i === CENTER ? '★' : session.text(i))));
}

export function render(app, code) {
  const s = openSession(code);
  if (!s) { go('/join/' + code, { replace: true }); return; }
  if (!s.ended) { go('/play/' + code, { replace: true }); return; }
  const list = s.standings();
  const [p1, p2, p3] = list;
  const pod = (p, place) => p ? h('div', { class: `pod p${place}` },
    h('span', { class: 'av', 'aria-hidden': 'true' }, p.emoji),
    h('span', { class: 'nm' }, p.me ? `${p.name} (you)` : p.name),
    h('small', null, `${p.points} pts · ${plural(p.bingos, 'bingo')}`),
    h('span', { class: 'blk', 'aria-label': `Place ${place}` }, place === 1 ? '1' : String(place))) : h('div', { class: 'pod' });
  const mine = list.find((p) => p.me);
  const myRank = list.findIndex((p) => p.me) + 1;

  app.append(h('main', { class: 'screen screen-enter' },
    pageHead('Final', '/games'),
    h('p', { class: 'center hint' }, `Game ${code}${s.config.opp ? ' · vs ' + s.config.opp : ''} · ${s.config.packName}`),
    h('div', { class: 'podium', role: 'list', 'aria-label': 'Podium' },
      h('div', { role: 'listitem' }, pod(p2, 2)), h('div', { role: 'listitem' }, pod(p1, 1)), h('div', { role: 'listitem' }, pod(p3, 3))),
    mine ? h('p', { class: 'center', style: { fontSize: '18px', fontWeight: '800' } },
      myRank === 1 ? '👑 You won!' : `You finished #${myRank} of ${list.length}`) : null,
    list.length > 3 ? h('ol', { class: 'lb', start: 4, style: { marginTop: '16px' } },
      ...list.slice(3).map((p, i) => h('li', { class: 'lb-row' + (p.me ? ' me' : '') },
        h('span', { class: 'lb-rank' }, String(i + 4)),
        h('span', { class: 'lb-av', 'aria-hidden': 'true' }, p.emoji),
        h('span', { class: 'lb-name' }, h('b', null, p.me ? `${p.name} (you)` : p.name), h('small', null, plural(p.bingos, 'bingo'))),
        heatMap(p.marks),
        h('span', { class: 'lb-score' }, h('b', null, String(p.points)), h('small', null, 'pts'))))) : null,
    h('h2', { class: 'section-title center' }, 'Your card'),
    miniBoard(s),
    h('div', { class: 'stack', style: { marginTop: '22px' } },
      h('button', {
        class: 'btn btn-primary btn-lg btn-block',
        onclick: () => import('../sharecard.js').then((m) => m.shareCard(s)),
      }, '📸 Share your card'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => go('/play/' + code) }, 'View board'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => go('/') }, 'Home'),
    ),
  ));

  // A little celebration for whoever lands on the podium top spot.
  if (myRank === 1 && settings().motion !== 'reduced' && !sessionStorage.getItem('gdb-final-' + code)) {
    sessionStorage.setItem('gdb-final-' + code, '1');
    setTimeout(() => confettiBig(), 300);
  }
}
