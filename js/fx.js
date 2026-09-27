// Visual juice. Animates transform/opacity only (Web Animations API).
import { h } from './ui.js';
import { reducedMotion } from './settings.js';
import { loadConfetti } from './libs.js';

const NS = 'http://www.w3.org/2000/svg';

/** Irregular dauber blot path (viewBox 0..100), from a seeded rand(). */
export function blotPath(rand) {
  const n = 11;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 37 + (rand() - 0.5) * 9;
    pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M${mid(pts[n - 1], pts[0]).map((v) => v.toFixed(1)).join(' ')}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  // A couple of satellite droplets.
  for (let k = 0; k < 2 + Math.floor(rand() * 2); k++) {
    const a = rand() * Math.PI * 2;
    const dist = 42 + rand() * 7;
    const r = 2 + rand() * 3.2;
    const cx = 50 + Math.cos(a) * dist, cy = 50 + Math.sin(a) * dist;
    d += `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;
  }
  return d + 'Z';
}

export function makeBlot(rand) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'blot');
  svg.setAttribute('aria-hidden', 'true');
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('filter', 'url(#gdb-rough)');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', blotPath(rand));
  path.setAttribute('fill', 'url(#gdb-ink)');
  g.append(path);
  svg.append(g);
  svg.style.setProperty('--blot-rot', `${Math.round((rand() - 0.5) * 70)}deg`);
  svg.style.setProperty('--blot-scale', (0.9 + rand() * 0.16).toFixed(2));
  return svg;
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}

function fxEl(cls, x, y, text) {
  const el = h('div', { class: 'fx ' + cls, 'aria-hidden': 'true', style: { left: x + 'px', top: y + 'px' } }, text);
  document.body.append(el);
  return el;
}

const done = (anim, el) => anim.finished.then(() => el.remove(), () => el.remove());

/** Blot scales 1.4 -> 1.0 with a rotation settle, plus a 6-particle ink splat. */
export function stamp(cell, blot) {
  const rot = parseFloat(blot.style.getPropertyValue('--blot-rot')) || 0;
  const sc = parseFloat(blot.style.getPropertyValue('--blot-scale')) || 1;
  if (reducedMotion()) {
    blot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    return;
  }
  blot.animate([
    { opacity: 0, transform: `rotate(${rot + 14}deg) scale(${sc * 1.4})` },
    { opacity: 1, transform: `rotate(${rot - 3}deg) scale(${sc * 0.96})`, offset: 0.72 },
    { opacity: 1, transform: `rotate(${rot}deg) scale(${sc})` },
  ], { duration: 190, easing: 'cubic-bezier(.2,.8,.3,1)' });
  const c = center(cell);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.8;
    const dist = c.w * (0.42 + Math.random() * 0.3);
    const dot = fxEl('fx-dot', c.x, c.y);
    const s = 0.6 + Math.random() * 0.9;
    done(dot.animate([
      { transform: `translate(0,0) scale(${s})`, opacity: 0.95 },
      { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) scale(${s * 0.3})`, opacity: 0 },
    ], { duration: 280 + Math.random() * 80, easing: 'cubic-bezier(.1,.7,.3,1)' }), dot);
  }
}

/** Quiet peel: the blot lifts, twists and fades. */
export function peel(blot) {
  const rot = parseFloat(blot.style.getPropertyValue('--blot-rot')) || 0;
  const sc = parseFloat(blot.style.getPropertyValue('--blot-scale')) || 1;
  const frames = reducedMotion()
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
      { opacity: 1, transform: `rotate(${rot}deg) scale(${sc})` },
      { opacity: 0, transform: `rotate(${rot - 18}deg) scale(${sc * 1.1}) translateY(-6%)` },
    ];
  return blot.animate(frames, { duration: 200, easing: 'ease-in' });
}

/** "+2" floats up from the cell. */
export function floatPoints(cell, text) {
  const c = center(cell);
  const el = fxEl('fx-pts', c.x, c.y - c.w * 0.2, text);
  const frames = reducedMotion()
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]
    : [
      { transform: 'translateY(0) scale(.6)', opacity: 0 },
      { transform: 'translateY(-14px) scale(1.1)', opacity: 1, offset: 0.2 },
      { transform: 'translateY(-52px) scale(1)', opacity: 0 },
    ];
  done(el.animate(frames, { duration: 760, easing: 'cubic-bezier(.2,.8,.3,1)' }), el);
}

/** Light a line's cells gold, one after another. Resolves when done. */
export function lightLine(cells) {
  const reduce = reducedMotion();
  const step = reduce ? 0 : 70;
  cells.forEach((cell, i) => {
    setTimeout(() => {
      cell.classList.add('won');
      const gold = cell.querySelector('.cell-gold');
      gold?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 150 : 180 });
      if (!reduce) {
        const rot = getComputedStyle(cell).getPropertyValue('--rot') || '0deg';
        cell.animate([
          { transform: `rotate(${rot}) scale(1)` },
          { transform: `rotate(${rot}) scale(1.09)` },
          { transform: `rotate(${rot}) scale(1)` },
        ], { duration: 240, easing: 'ease-out' });
      }
    }, i * step);
  });
  return new Promise((r) => setTimeout(r, cells.length * step + 180));
}

export function shake(el = document.getElementById('app')) {
  if (reducedMotion() || !el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 320);
}

/** Giant distressed BINGO! stamp. */
export function slam(word = 'BINGO!', sub = '') {
  const wordEl = h('div', { class: 'slam-word distress' }, word);
  const box = h('div', null, wordEl, sub ? h('span', { class: 'slam-sub' }, sub) : null);
  const el = h('div', { class: 'slam', role: 'status', 'aria-live': 'assertive' }, box);
  document.body.append(el);
  const reduce = reducedMotion();
  const anim = reduce
    ? box.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1500 })
    : box.animate([
      { transform: 'scale(2)', opacity: 0 },
      { transform: 'scale(.9)', opacity: 1, offset: 0.16 },
      { transform: 'scale(1.04)', opacity: 1, offset: 0.24 },
      { transform: 'scale(1)', opacity: 1, offset: 0.3 },
      { transform: 'scale(1)', opacity: 1, offset: 0.82 },
      { transform: 'scale(1.08)', opacity: 0 },
    ], { duration: 1700, easing: 'cubic-bezier(.2,.9,.3,1)' });
  done(anim, el);
  return anim.finished.catch(() => {});
}

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  return ['--primary', '--gold', '--paper', '--primary', '--gold']
    .map((v) => cs.getPropertyValue(v).trim())
    .filter(Boolean);
}

/** Two side cannons, then a top burst. */
export async function confettiBig() {
  if (reducedMotion()) return;
  let confetti;
  try { confetti = await loadConfetti(); } catch { return; }
  const colors = themeColors();
  const base = { colors, disableForReducedMotion: true, zIndex: 65, ticks: 260 };
  confetti({ ...base, particleCount: 70, angle: 60, spread: 60, startVelocity: 62, origin: { x: 0, y: 0.8 } });
  confetti({ ...base, particleCount: 70, angle: 120, spread: 60, startVelocity: 62, origin: { x: 1, y: 0.8 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: 120, spread: 160, startVelocity: 38, gravity: 0.9, origin: { x: 0.5, y: -0.05 }, angle: 270 });
  }, 380);
}

/** Small puff when someone else gets a bingo. */
export async function confettiPuff() {
  if (reducedMotion()) return;
  let confetti;
  try { confetti = await loadConfetti(); } catch { return; }
  confetti({
    colors: themeColors(), disableForReducedMotion: true, zIndex: 65,
    particleCount: 36, spread: 70, startVelocity: 28, scalar: 0.8, ticks: 140, origin: { x: 0.5, y: 0.12 },
  });
}
