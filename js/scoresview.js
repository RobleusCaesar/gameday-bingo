// Leaderboard with mini heat-maps, crown for the leader, FLIP row slides and rank flips.
import { h, plural, setChildren } from './ui.js';
import { bitsToMarks, CENTER } from './rules.js';
import { reducedMotion } from './settings.js';

export function heatMap(bits) {
  const marks = bitsToMarks(bits >>> 0);
  return h('span', { class: 'heat', 'aria-hidden': 'true' },
    ...marks.map((m, i) => h('i', { class: i === CENTER ? 'free' : m ? 'on' : '' })));
}

export class ScoresView {
  constructor(session) {
    this.s = session;
    this.rows = new Map(); // pid -> { el, rank }
    this.note = h('p', { class: 'offline-note', role: 'status' });
    this.list = h('ol', { class: 'lb', 'aria-label': 'Leaderboard' });
    this.el = h('div', null, this.note, this.list);
    this.render();
  }

  _row(p) {
    const el = h('li', { class: 'lb-row' });
    el.dataset.pid = p.pid;
    return { el, rank: 0 };
  }

  _fill(el, p, rank, leader) {
    const name = p.me ? `${p.name} (you)` : p.name;
    el.className = 'lb-row' + (p.me ? ' me' : '') + (!p.online && !p.me && !this.s.ended ? ' away' : '');
    el.setAttribute('aria-label', `${rank}. ${name}: ${plural(p.points, 'point')}, ${plural(p.bingos, 'bingo')}`);
    setChildren(el,
      h('span', { class: 'lb-rank', 'aria-hidden': 'true' }, String(rank)),
      h('span', { class: 'lb-av', 'aria-hidden': 'true' }, p.emoji, leader ? h('span', { class: 'lb-crown' }, '👑') : null),
      h('span', { class: 'lb-name', 'aria-hidden': 'true' }, h('b', null, name),
        h('small', null, p.bingos ? `${plural(p.bingos, 'bingo')}${p.host ? ' · host' : ''}` : (p.host ? 'host' : (!p.online && !p.me ? 'away' : 'no bingo yet')))),
      heatMap(p.marks),
      h('span', { class: 'lb-score', 'aria-hidden': 'true' }, h('b', null, String(p.points)), h('small', null, 'pts')),
    );
  }

  render() {
    const s = this.s;
    const live = s.syncStatus === 'live';
    this.note.hidden = live || s.ended;
    this.note.textContent = s.syncStatus === 'off'
      ? 'Solo game: live scores aren’t set up on this site.'
      : s.syncStatus === 'connecting' ? 'Connecting… scores sync when connected.' : 'offline — scores sync when connected';

    const list = s.standings();
    const first = new Map();
    for (const [pid, r] of this.rows) first.set(pid, r.el.getBoundingClientRect().top);

    const keep = new Set();
    list.forEach((p, i) => {
      const rank = i + 1;
      let row = this.rows.get(p.pid);
      if (!row) { row = this._row(p); this.rows.set(p.pid, row); }
      const leader = rank === 1 && (p.points > 0 || p.bingos > 0);
      this._fill(row.el, p, rank, leader);
      if (row.rank && row.rank !== rank && !reducedMotion()) {
        row.el.querySelector('.lb-rank')?.classList.add('flip');
      }
      row.rank = rank;
      keep.add(p.pid);
      this.list.append(row.el); // re-appending moves it into order
    });
    for (const [pid, row] of this.rows) {
      if (!keep.has(pid)) { row.el.remove(); this.rows.delete(pid); }
    }

    if (reducedMotion()) return;
    for (const [pid, row] of this.rows) {
      const before = first.get(pid);
      if (before == null) continue;
      const after = row.el.getBoundingClientRect().top;
      const dy = before - after;
      if (Math.abs(dy) > 1) {
        row.el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
      }
    }
  }
}
