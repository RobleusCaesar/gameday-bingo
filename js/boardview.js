// The 5×5 card: layout, text fitting, tap / long-press, and mark animations.
import { h, ICON } from './ui.js';
import { seeded } from './rng.js';
import { CENTER, POINTS, cellsForKey, bingoKeys } from './rules.js';
import { makeBlot, stamp, peel, floatPoints } from './fx.js';
import { reducedMotion } from './settings.js';
import { BOARD_LOGO } from '../config.js';

const RARITY = { C: 'common', U: 'uncommon', R: 'rare' };
const LONG_PRESS_MS = 460;
const MIN_FONT = 11;
const LINE_HEIGHT = 1.0;
const FONT_STACK = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif-condensed, sans-serif';

let measureCtx = null;
const SHY = '­';
const VOWEL = /[AEIOUY]/;

function ctx(size) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = `600 ${size}px ${FONT_STACK}`;
  return measureCtx;
}

/** Break units: words split on spaces and after slashes; pieces split after hyphens and at soft hyphens. */
function units(text) {
  return text.toUpperCase().replace(/\//g, '/ ').split(/\s+/).filter(Boolean)
    .map((word) => word.split(/(?<=-)|\u00AD/).map((part, k, all) => (k < all.length - 1 && !part.endsWith('-') ? part + '-' : part)));
}

/** Largest font size (px) at which `text` wraps into a w×h box, never below 11px. */
export function fitFont(text, w, hgt, max) {
  return layout(text, w, hgt, max).size;
}

/** Returns { size, fits, lines } for the best size; at 11px `fits` may be false. */
export function layout(text, w, hgt, max) {
  // Glyph widths scale linearly with font size, so measure once at 100px.
  const c = ctx(100);
  const space100 = c.measureText(' ').width;
  const words = units(text).map((pieces) => pieces.map((piece) => c.measureText(piece).width));
  let last = null;
  for (let size = max; size >= MIN_FONT; size -= 0.5) {
    const k = size / 100;
    const space = space100 * k;
    const lh = size * LINE_HEIGHT;
    let lines = 1;
    let line = 0;
    let ok = true;
    for (const pieces of words) {
      for (const [i, w100] of pieces.entries()) {
        const ww = w100 * k;
        if (ww > w) { ok = false; break; }
        const gap = i === 0 ? space : 0;
        if (!line) line = ww;
        else if (line + gap + ww <= w) line += gap + ww;
        else { lines++; line = ww; }
      }
      if (!ok) break;
    }
    last = { size, fits: ok && lines * lh <= hgt, lines, wordsFit: ok };
    if (last.fits) return last;
  }
  return { ...last, size: MIN_FONT };
}

/**
 * Words too wide even at 11px get a soft hyphen at a syllable-ish boundary
 * (between two consonants, or before a consonant+vowel), as close to the middle as fits.
 */
export function hyphenate(text, w) {
  const c = ctx(MIN_FONT);
  return text.split(' ').map((word) => {
    const up = word.toUpperCase();
    if (/[/-]/.test(word) || c.measureText(up).width <= w) return word;
    let best = -1;
    let bestScore = Infinity;
    for (let k = 3; k <= word.length - 3; k++) {
      const a = up[k - 1], b = up[k], next = up[k + 1] || '';
      const cc = !VOWEL.test(a) && !VOWEL.test(b) && /[A-Z]/.test(a + b);
      const vcv = VOWEL.test(a) && !VOWEL.test(b) && VOWEL.test(next);
      if (!cc && !vcv) continue;
      if (c.measureText(up.slice(0, k) + '-').width > w || c.measureText(up.slice(k)).width > w) continue;
      const score = Math.abs(k - word.length / 2);
      if (score < bestScore) { bestScore = score; best = k; }
    }
    return best > 0 ? word.slice(0, best) + SHY + word.slice(best) : word;
  }).join(' ');
}

function renderText(span, text) {
  const parts = text.split('/').flatMap((part, k, all) => (k < all.length - 1 ? [part + '/', h('wbr')] : [part]));
  span.replaceChildren(...parts);
}

export class BoardView {
  /**
   * @param {import('./game.js').GameSession} session
   * @param {{onTap:(i:number)=>void, onLongPress:(i:number)=>void}} handlers
   */
  constructor(session, handlers) {
    this.s = session;
    this.handlers = handlers;
    this.cells = [];
    this.blots = [];
    this.el = h('section', { class: 'board', 'aria-label': 'Your bingo card' });
    this.banner = this._banner();
    this.letters = h('div', { class: 'bingo-letters', 'aria-hidden': 'true' },
      ...'BINGO'.split('').map((c) => h('span', { class: 'distress' }, c)));
    this.grid = h('div', { class: 'grid', role: 'group', 'aria-label': 'Bingo squares' });
    this.el.append(this.banner, this.letters, this.grid);
    this.build();
    this._ro = new ResizeObserver(() => this._scheduleFit());
    this._ro.observe(this.grid);
    // Refit once the web font arrives (the stylesheet loads async, so this may be later).
    this._onFonts = () => this._scheduleFit();
    document.fonts?.addEventListener?.('loadingdone', this._onFonts);
    document.fonts?.load?.('600 16px "Barlow Condensed"').then(this._onFonts).catch(() => {});
  }

  _banner() {
    const cfg = this.s.config;
    const box = h('div', { class: 'board-banner' });
    const mark = h('div', { class: 'banner-mark' },
      h('span', { class: 'k' }, 'Gameday Bingo'),
      h('span', { class: 'w distress' }, cfg.opp ? `vs ${cfg.opp}` : cfg.packName),
      cfg.opp ? h('span', { class: 'vs' }, cfg.packName) : null,
    );
    if (BOARD_LOGO) {
      const img = h('img', { src: BOARD_LOGO, alt: 'Game logo', decoding: 'async' });
      img.addEventListener('error', () => box.replaceChildren(mark));
      box.append(img);
    } else {
      box.append(mark);
    }
    return box;
  }

  build() {
    const s = this.s;
    this.cells = [];
    this.blots = [];
    const tilt = seeded('tilt:' + s.code + s.me.id);
    const cells = s.board.map((sq, i) => {
      const rot = ((tilt() - 0.5) * 1.2).toFixed(2) + 'deg';
      const blot = makeBlot(seeded(`blot:${s.code}:${i}:${sq ? sq.t : 'free'}`));
      const cell = h('button', { class: 'cell', type: 'button', style: { '--rot': rot }, dataset: { i } });
      cell.style.setProperty('--rot', rot);
      cell.append(h('span', { class: 'cell-gold', 'aria-hidden': 'true' }), blot);
      if (!sq) {
        cell.classList.add('free', 'marked');
        cell.setAttribute('aria-pressed', 'true');
        cell.setAttribute('aria-disabled', 'true');
        cell.append(h('span', { class: 'free-glyph', html: ICON.star }, h('b', null, 'FREE')), h('span', { class: 'sr-only' }, ' space'));
      } else {
        const text = s.text(i);
        const inner = h('span');
        renderText(inner, text);
        cell.append(h('span', { class: 'cell-text' }, inner),
          h('span', { class: 'sr-only' }, `, ${RARITY[sq.r]}, ${POINTS[sq.r]} point${POINTS[sq.r] > 1 ? 's' : ''}`));
        if (sq.r !== 'C') cell.append(h('span', { class: 'cell-pts ' + sq.r, 'aria-hidden': 'true' }, String(POINTS[sq.r])));
        cell.append(h('span', { class: 'cell-check', 'aria-hidden': 'true', html: ICON.check }));
        this._wire(cell, i);
      }
      this.cells.push(cell);
      this.blots.push(blot);
      return cell;
    });
    this.grid.replaceChildren(...cells);
    this.refresh();
    this._scheduleFit();
  }

  _wire(cell, i) {
    let timer = null;
    let fired = false;
    let start = null;
    const cancel = () => {
      clearTimeout(timer);
      timer = null;
      cell.classList.remove('pressed');
    };
    cell.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      fired = false;
      start = { x: e.clientX, y: e.clientY };
      if (!this.s.ended) cell.classList.add('pressed');
      timer = setTimeout(() => {
        fired = true;
        cell.classList.remove('pressed');
        this.handlers.onLongPress(i);
      }, LONG_PRESS_MS);
    });
    cell.addEventListener('pointermove', (e) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
    });
    cell.addEventListener('pointerup', cancel);
    cell.addEventListener('pointercancel', cancel);
    cell.addEventListener('pointerleave', cancel);
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!fired) { fired = true; cancel(); this.handlers.onLongPress(i); }
    });
    cell.addEventListener('click', (e) => {
      if (fired) { fired = false; e.preventDefault(); return; }
      this.handlers.onTap(i);
    });
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); this.handlers.onLongPress(i); }
    });
  }

  _scheduleFit() {
    cancelAnimationFrame(this._fitRaf);
    this._fitRaf = requestAnimationFrame(() => this.fit());
  }

  /** Size every cell's text to fit (canvas measurement, no layout thrash). */
  fit() {
    const first = this.cells.find((c) => !c.classList.contains('free'));
    if (!first) return;
    const size = first.clientWidth; // inner width (inside the 2px border)
    if (!size) return;
    const w = size - 10;
    const hgt = size - 8;
    const max = Math.max(MIN_FONT, Math.min(24, size * 0.3));
    this.cells.forEach((cell, i) => {
      const span = cell.querySelector('.cell-text');
      if (!span) return;
      let text = this.s.text(i);
      let fit = layout(text, w, hgt, max);
      if (!fit.wordsFit) {
        const hy = hyphenate(text, w);
        if (hy !== text) { text = hy; fit = layout(text, w, hgt, max); }
      }
      if (span.dataset.text !== text) { renderText(span.firstChild, text); span.dataset.text = text; }
      span.style.fontSize = fit.size + 'px';
      // Last resort at 11px: clamp lines (long-press shows the full text).
      const maxLines = Math.floor(hgt / (MIN_FONT * LINE_HEIGHT));
      span.classList.toggle('clamp', !fit.fits);
      span.style.setProperty('--lines', String(maxLines));
    });
    this.grid.style.setProperty('--cell-size', size + 'px');
  }

  /** Sync classes with state: marked, won, near-miss, "1 AWAY". */
  refresh() {
    const s = this.s;
    const ev = s.evaluate();
    const won = new Set();
    for (const key of bingoKeys(ev)) for (const c of cellsForKey(key)) won.add(c);
    const near = new Set();
    const need = new Set();
    for (const n of ev.near) {
      need.add(n.cell);
      for (const c of cellsForKey('L' + n.line)) if (c !== n.cell && !won.has(c)) near.add(c);
    }
    this.cells.forEach((cell, i) => {
      const marked = !!s.marks[i];
      cell.classList.toggle('marked', marked);
      if (i !== CENTER) cell.setAttribute('aria-pressed', String(marked));
      cell.classList.toggle('won', won.has(i));
      cell.classList.toggle('near', near.has(i) && !s.ended);
      const needs = need.has(i) && !s.ended;
      cell.classList.toggle('need', needs);
      const chip = cell.querySelector('.away-chip');
      if (needs && !chip) cell.append(h('span', { class: 'away-chip', 'aria-hidden': 'true' }, '1 AWAY'));
      else if (!needs && chip) chip.remove();
      if (i !== CENTER) {
        if (s.ended) cell.setAttribute('aria-disabled', 'true'); else cell.removeAttribute('aria-disabled');
      }
    });
  }

  cellsFor(keys) {
    const idx = new Set();
    for (const k of keys) for (const c of cellsForKey(k)) idx.add(c);
    return [...idx].map((i) => this.cells[i]);
  }

  animateMark(i, points) {
    const cell = this.cells[i];
    stamp(cell, this.blots[i]);
    floatPoints(cell, '+' + points);
  }

  animateUnmark(i) {
    const blot = this.blots[i];
    const cell = this.cells[i];
    cell.classList.add('marked'); // keep it visible while the peel plays
    peel(blot).finished.then(() => this.refresh(), () => this.refresh());
  }

  /** Flip the cards over for a reroll. */
  animateReroll() {
    if (reducedMotion()) { this.build(); return; }
    const out = this.cells.map((c, i) => c.animate(
      [{ transform: `rotate(${c.style.getPropertyValue('--rot')}) scale(1)`, opacity: 1 }, { transform: 'rotate(0deg) scale(.4)', opacity: 0 }],
      { duration: 160, delay: (i % 5) * 18 + Math.floor(i / 5) * 18, easing: 'ease-in', fill: 'forwards' },
    ).finished);
    Promise.all(out).then(() => {
      this.build();
      this.cells.forEach((c, i) => c.animate(
        [{ transform: 'rotate(0deg) scale(.4)', opacity: 0 }, { transform: `rotate(${c.style.getPropertyValue('--rot')}) scale(1)`, opacity: 1 }],
        { duration: 240, delay: (i % 5) * 22 + Math.floor(i / 5) * 22, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' },
      ));
    });
  }

  destroy() {
    this._ro?.disconnect();
    document.fonts?.removeEventListener?.('loadingdone', this._onFonts);
    cancelAnimationFrame(this._fitRaf);
  }
}
