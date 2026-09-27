import { h, icon, sheet, toast, banner, confirmSheet, timeAgo, plural, ICON } from '../ui.js';
import { go } from '../nav.js';
import { openSession } from '../game.js';
import { BoardView } from '../boardview.js';
import { ScoresView } from '../scoresview.js';
import { invitePanel } from '../invite.js';
import { settings, updateSettings } from '../settings.js';
import { POINTS } from '../rules.js';
import { holdScreen, wakeLockSupported } from '../wakelock.js';
import * as sfx from '../audio.js';
import * as haptics from '../haptics.js';
import * as fx from '../fx.js';

const RARITY_NAME = { C: 'Common', U: 'Uncommon', R: 'Rare' };
const PATTERN_WORD = { blackout: 'BLACKOUT!', x: 'X MARKS IT!', corners: 'FOUR CORNERS!' };

function notFound(app, code) {
  app.append(h('main', { class: 'screen screen-enter' },
    h('div', { class: 'empty' },
      h('p', { style: { fontSize: '44px' } }, '🤔'),
      h('p', null, `Game ${code} isn’t on this device yet.`),
      h('div', { class: 'stack', style: { marginTop: '20px' } },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('/join/' + code, { replace: true }) }, 'Join game ' + code),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => go('/') }, 'Home')))));
}

function switchRow(label, sub, checked, onChange) {
  const sw = h('button', {
    type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(checked), 'aria-label': label,
    onclick: () => { checked = !checked; sw.setAttribute('aria-checked', String(checked)); onChange(checked); },
  });
  return h('div', { class: 'set-row' }, h('div', { class: 'l' }, h('b', null, label), sub ? h('small', null, sub) : null), sw);
}

export function render(app, code) {
  const s = openSession(code);
  if (!s) { notFound(app, code); return; }
  const me = s.me;
  let disposed = false;
  let tab = 'board';
  let unread = 0;
  const quickToasts = new Map();

  /* ---------- Top bar ---------- */
  const dot = h('span', { class: 'dot' });
  const countEl = h('span');
  const pill = h('button', { class: 'players-pill', onclick: () => setTab('scores') }, dot, h('span', { 'aria-hidden': 'true' }, '👥'), countEl);
  const muteBtn = h('button', { class: 'icon-btn', 'aria-label': 'Mute sounds', onclick: () => { updateSettings({ sound: !settings().sound }); paintMute(); if (settings().sound) sfx.blip(); } });
  const paintMute = () => {
    const on = settings().sound;
    muteBtn.innerHTML = on ? ICON.sound : ICON.mute;
    muteBtn.setAttribute('aria-pressed', String(!on));
  };
  paintMute();
  const topbar = h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': 'Home', onclick: () => go('/') }, icon('back')),
    h('button', { class: 'code-chip', onclick: openInvite },
      h('span', { class: 'sr-only' }, 'Game code '), h('span', null, code), h('span', { class: 'sr-only' }, ', invite friends'), icon('share')),
    h('span', { class: 'spacer' }),
    pill,
    muteBtn,
    h('button', { class: 'icon-btn', 'aria-label': 'Game menu', onclick: openMenu }, icon('more')),
  );

  const paintPill = () => {
    dot.className = 'dot ' + (s.syncStatus === 'live' ? 'live' : s.syncStatus === 'connecting' ? 'connecting' : '');
    const n = s.syncStatus === 'live' ? s.onlineCount() : s.standings().length;
    countEl.textContent = String(n);
    const state = { live: 'live', connecting: 'connecting', offline: 'offline', off: 'solo' }[s.syncStatus] || 'offline';
    pill.setAttribute('aria-label', `${plural(n, 'player')}, ${state}. Show scores`);
  };

  /* ---------- Board panel ---------- */
  const board = new BoardView(s, { onTap, onLongPress });
  const stripPts = h('span', { class: 'v' });
  const stripBingos = h('span', { class: 'v' });
  const stripRank = h('span', { class: 'v' });
  const strip = h('div', { class: 'score-strip', role: 'group', 'aria-label': 'Your score' },
    h('div', null, stripPts, h('span', { class: 'l' }, 'Points')),
    h('div', null, stripBingos, h('span', { class: 'l' }, 'Bingos')),
    h('div', null, stripRank, h('span', { class: 'l' }, 'Rank')));
  const actions = h('div', { class: 'board-actions' });

  const paintStrip = () => {
    const ev = s.evaluate();
    const { rank, of } = s.myRank();
    stripPts.textContent = String(ev.points);
    stripBingos.textContent = String(ev.bingos);
    stripRank.textContent = of > 1 ? `${rank}/${of}` : '–';
    actions.replaceChildren();
    if (s.ended) {
      actions.append(h('div', { class: 'ended-note' }, '🏁 Final whistle. This game is over.',
        h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn btn-gold', onclick: () => go('/final/' + code) }, 'See the podium'))));
    } else if (s.canReroll()) {
      actions.append(h('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          if (s.reroll()) { sfx.peel(); haptics.tap(); board.animateReroll(); paintStrip(); }
        },
      }, '🎲 Reroll my board', h('span', { class: 'hint' }, '(1 left)')));
    }
  };

  /* ---------- Scores & feed ---------- */
  const scores = new ScoresView(s);
  const sideScores = new ScoresView(s);
  const feedList = h('ol', { class: 'feed', 'aria-label': 'Game feed' });
  const feedEmpty = h('p', { class: 'empty' }, 'Nothing yet. Every mark and bingo shows up here.');

  const feedItem = (it, fresh) => {
    const mine = it.pid === me.id;
    const who = h('b', null, mine ? 'You' : it.name);
    let body;
    let cls = 'feed-item';
    let emoji = it.emoji || '🏈';
    switch (it.type) {
      case 'mark': body = [who, ' marked ', h('span', { class: 'sq' }, it.text)]; break;
      case 'unmark': body = [who, ' unmarked ', h('span', { class: 'sq' }, it.text)]; cls += ' muted'; break;
      case 'bingo': body = [who, ' got ', h('span', { class: 'sq' }, it.label && it.label !== 'Line' ? it.label : 'BINGO'), ' 🎉']; cls += ' bingo'; break;
      case 'join': body = [who, ' joined the game 👋']; break;
      case 'end': emoji = '🏁'; body = ['Game over', it.name ? ` (ended by ${it.name})` : '', '. Final scores are in.']; cls += ' bingo'; break;
      default: body = ['…'];
    }
    const when = new Date(it.at);
    return h('li', { class: cls + (fresh ? ' new' : '') },
      h('span', { class: 'fe', 'aria-hidden': 'true' }, emoji),
      h('span', { class: 'ft' }, ...body),
      h('time', { datetime: Number.isNaN(when.getTime()) ? null : when.toISOString(), dataset: { at: it.at } }, timeAgo(it.at)));
  };
  const paintFeed = () => {
    feedList.replaceChildren(...s.state.feed.map((it) => feedItem(it, false)));
    feedEmpty.hidden = s.state.feed.length > 0;
  };
  const tickTimes = setInterval(() => {
    feedList.querySelectorAll('time').forEach((t) => { t.textContent = timeAgo(Number(t.dataset.at)); });
  }, 30000);

  /* ---------- Tabs ---------- */
  const panels = {
    board: h('section', { class: 'panel', id: 'panel-board', role: 'tabpanel', 'aria-labelledby': 'tab-board' }, board.el, strip, actions),
    scores: h('section', { class: 'panel', id: 'panel-scores', role: 'tabpanel', 'aria-labelledby': 'tab-scores', hidden: true },
      h('h2', { class: 'section-title', style: { marginTop: '6px' } }, s.ended ? 'Final scores' : 'Leaderboard'), scores.el),
    feed: h('section', { class: 'panel', id: 'panel-feed', role: 'tabpanel', 'aria-labelledby': 'tab-feed', hidden: true },
      h('h2', { class: 'section-title', style: { marginTop: '6px' } }, 'Live feed'), feedEmpty, feedList),
  };
  const badge = h('span', { class: 'badge', hidden: true });
  const tabBtn = (id, ico, label, extra) => h('button', {
    class: 'tab', role: 'tab', id: 'tab-' + id, 'aria-controls': 'panel-' + id, 'aria-selected': String(id === tab),
    dataset: { tab: id }, onclick: () => setTab(id),
  }, h('span', { class: 'ti', 'aria-hidden': 'true' }, ico), label, extra);
  const tabs = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Game views' },
    tabBtn('board', '🎯', 'Board'), tabBtn('scores', '🏆', 'Scores'), tabBtn('feed', '📣', 'Feed', badge));

  function setTab(id) {
    tab = id;
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== id;
    tabs.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    if (id === 'feed') { unread = 0; paintBadge(); }
    if (id === 'scores') scores.render();
    if (id === 'board') board._scheduleFit();
    window.scrollTo({ top: 0 });
  }
  const paintBadge = () => {
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? '9+' : String(unread);
  };

  const main = h('div', { class: 'play-main' }, panels.board, panels.scores, panels.feed);
  const side = h('aside', { class: 'play-side', 'aria-label': 'Leaderboard' }, h('h2', { class: 'section-title' }, 'Leaderboard'), sideScores.el);
  app.append(h('main', { class: 'screen play' }, topbar, h('div', { class: 'play-body', style: { flex: '1' } }, main, side), tabs));

  /* ---------- Marking & juice ---------- */
  function onTap(i) {
    if (s.ended) { onLongPress(i); return; }
    const res = s.toggle(i);
    if (!res) return;
    celebrateMark(i, res);
  }

  function celebrateMark(i, res) {
    const lightCells = res.marked && res.completed.length ? board.cellsFor(res.completed) : [];
    board.refresh();
    lightCells.forEach((c) => c.classList.remove('won'));
    if (res.marked) {
      sfx.thwack();
      haptics.tap();
      board.animateMark(i, res.points);
    } else {
      sfx.peel();
      haptics.soft();
      board.animateUnmark(i);
    }
    paintStrip();
    scores.render();
    sideScores.render();
    if (!lightCells.length) return;
    setTimeout(async () => {
      sfx.arpeggio();
      haptics.double();
      await fx.lightLine(lightCells);
      board.refresh();
      if (res.fresh.length) bingo(res);
    }, 150);
  }

  function bingo(res) {
    const ev = s.evaluate();
    const pattern = ['blackout', 'x', 'corners'].find((k) => res.fresh.includes(k));
    const word = PATTERN_WORD[pattern] || 'BINGO!';
    const sub = res.firstInGame ? 'First in the game!' : ev.bingos > 1 ? `${ev.bingos} bingos` : '';
    const big = res.firstMine || pattern === 'blackout' || pattern === 'x';
    if (big) {
      fx.shake();
      fx.slam(word, sub);
      fx.confettiBig();
      sfx.bingoFanfare();
      haptics.long();
      if (res.firstMine) setTimeout(afterFirstBingo, 1800);
    } else {
      fx.slam(word, sub);
      fx.confettiPuff();
      sfx.chime();
      haptics.double();
    }
  }

  function afterFirstBingo() {
    if (disposed) return;
    const ev = s.evaluate();
    const { rank, of } = s.myRank();
    sheet((close) => h('div', { class: 'center' },
      h('h2', null, 'BINGO! 🎉'),
      h('p', { style: { fontSize: '17px' } }, `${ev.points} points`, of > 1 ? ` · #${rank} of ${of}` : ''),
      h('p', { class: 'hint', style: { marginTop: '6px' } }, 'Play keeps going. More lines, more points.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => { close(); shareMyCard(); } }, '📸 Share your card'),
        h('button', { class: 'btn btn-ghost btn-block', autofocus: true, onclick: () => close() }, 'Keep playing'))),
    { label: 'Bingo!' });
  }

  function onLongPress(i) {
    const sq = s.board[i];
    if (!sq) return;
    haptics.soft();
    const text = s.text(i);
    sheet((close) => h('div', null,
      h('p', { class: 'full-text' }, text),
      h('p', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } },
        h('span', { class: 'chip chip-' + sq.r }, RARITY_NAME[sq.r]),
        h('span', { class: 'chip' }, plural(POINTS[sq.r], 'point')),
        s.marks[i] ? h('span', { class: 'chip chip-live' }, '✓ Marked') : null),
      s.ended ? null : h('div', { class: 'actions' },
        h('button', {
          class: 'btn btn-block ' + (s.marks[i] ? 'btn-ghost' : 'btn-primary'),
          onclick: () => { close(); onTap(i); },
        }, s.marks[i] ? 'Unmark' : 'Mark it'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => close() }, 'Close')),
    ), { label: text });
  }

  /* ---------- Sheets ---------- */
  function openInvite() {
    sheet((close) => h('div', null,
      h('h2', { class: 'center' }, 'Invite friends'),
      invitePanel(s, { compact: true }),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-ghost btn-block', onclick: () => close() }, 'Close'))),
    { label: 'Invite friends' });
  }

  function openMenu() {
    sheet((close) => {
      const endNote = s.ended ? 'This game is over.' : s.canEnd() ? 'Freezes scores for everyone and shows the podium.' : 'Only the host can end the game. Anyone can after 4 hours.';
      return h('div', null,
        h('h2', null, 'Game ' + code),
        h('div', { class: 'menu-list' },
          wakeLockSupported ? switchRow('Keep screen awake', 'Stops your phone dimming mid-drive', settings().wakeLock, (v) => {
            updateSettings({ wakeLock: v });
            holdScreen(v && !s.ended);
          }) : null,
          h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openInvite(); } }, '📤 Invite friends'),
          h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); shareMyCard(); } }, '📸 Share my card'),
          s.canSwap() ? h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); go('/lobby/' + code); } }, '🔁 Swap a square (host)') : null,
          h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); go('/settings'); } }, '⚙️ Settings'),
          s.ended
            ? h('button', { class: 'btn btn-gold btn-block', onclick: () => { close(); go('/final/' + code); } }, '🏆 See the podium')
            : h('button', { class: 'btn btn-danger btn-block', disabled: !s.canEnd(), onclick: () => { close(); endGame(); } }, '🏁 End game'),
          h('p', { class: 'hint' }, endNote),
        ),
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-ghost btn-block', onclick: () => close() }, 'Close')),
      );
    }, { label: 'Game menu' });
  }

  async function endGame() {
    const ok = await confirmSheet({
      title: 'End the game?',
      body: 'Scores freeze for everyone and the final podium shows. This can’t be undone.',
      ok: '🏁 End game',
      danger: true,
    });
    if (ok && s.end()) go('/final/' + code);
  }

  function shareMyCard() {
    import('../sharecard.js').then((m) => m.shareCard(s)).catch(() => toast({ tag: '⚠️', title: 'Couldn’t make the card', duration: 2500 }));
  }

  /* ---------- Session events ---------- */
  const on = {
    change: () => { paintStrip(); scores.render(); sideScores.render(); },
    players: () => { paintPill(); paintStrip(); scores.render(); sideScores.render(); },
    status: () => { paintPill(); scores.render(); sideScores.render(); },
    board: () => {
      board.build();
      paintStrip();
      // Board changed under any pending "Got it too" toasts.
      for (const t of quickToasts.values()) t.close();
      quickToasts.clear();
    },
    feed: (e) => {
      const it = e.detail;
      feedList.prepend(feedItem(it, tab === 'feed'));
      while (feedList.children.length > 150) feedList.lastChild.remove();
      feedEmpty.hidden = true;
      if (tab !== 'feed' && it.pid !== me.id && it.type !== 'unmark') { unread++; paintBadge(); }
    },
    quickmark: (e) => {
      const { tmpl, from, text } = e.detail;
      const key = 'qm:' + text.toLowerCase();
      sfx.blip();
      const t = toast({
        key,
        tag: from.emoji,
        title: text,
        sub: `${from.name} marked it. It’s on your card too!`,
        action: 'Got it too',
        duration: 8000,
        onAction: () => {
          quickToasts.delete(key);
          const idx = s.indexOfSquare(tmpl); // look it up now: the board may have changed
          if (idx < 0 || s.ended) return;
          if (tab !== 'board') setTab('board');
          const res = s.toggle(idx);
          if (res) requestAnimationFrame(() => celebrateMark(idx, res));
        },
      });
      quickToasts.set(key, t);
    },
    unquick: (e) => {
      const key = 'qm:' + e.detail.text.toLowerCase();
      quickToasts.get(key)?.close();
      quickToasts.delete(key);
    },
    'remote-bingo': (e) => {
      const { player, label, first } = e.detail;
      const what = label && label !== 'Line' ? label.toUpperCase() : 'BINGO';
      banner(first ? `${player.name} got ${what} first!` : `${player.name} got ${what}!`, player.emoji);
      fx.confettiPuff();
      sfx.chime();
      haptics.soft();
    },
    ended: (e) => {
      paintStrip();
      board.refresh();
      holdScreen(false);
      const by = e.detail?.byName;
      if (by && by !== me.name) banner(`${by} ended the game`, '🏁', 1800);
      setTimeout(() => { if (!disposed) go('/final/' + code); }, by && by !== me.name ? 1600 : 0);
    },
  };
  paintPill();
  paintStrip();
  paintFeed();
  for (const [k, fn] of Object.entries(on)) s.addEventListener(k, fn);
  holdScreen(settings().wakeLock && !s.ended);

  // In landscape the leaderboard lives beside the board, so leave the Scores tab.
  const sideBySide = window.matchMedia('(min-width: 900px), (orientation: landscape) and (min-width: 640px)');
  const onLayout = () => { if (sideBySide.matches && tab === 'scores') setTab('board'); };
  sideBySide.addEventListener?.('change', onLayout);

  return () => {
    disposed = true;
    for (const [k, fn] of Object.entries(on)) s.removeEventListener(k, fn);
    clearInterval(tickTimes);
    sideBySide.removeEventListener?.('change', onLayout);
    board.destroy();
    holdScreen(false);
    for (const t of quickToasts.values()) t.close();
  };
}
