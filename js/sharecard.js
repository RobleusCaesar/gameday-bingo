// Share card: a PNG of your board (marks, winning lines, score, rank) plus a
// Wordle-style emoji grid, shared with navigator.share.
import { h, sheet, say, copyText, plural } from './ui.js';
import { evaluate, bingoKeys, cellsForKey, CENTER } from './rules.js';
import { fill, appUrl } from './share.js';
import { blotPath } from './fx.js';
import { seeded } from './rng.js';
import { BOARD_LOGO } from '../config.js';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const W = 1080;
const H = 1350;
const FONTS = ['400 64px "Alfa Slab One"', '800 40px "Barlow Condensed"', '600 28px "Inter"'];

function vars() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, d) => cs.getPropertyValue(n).trim() || d;
  return {
    bg: v('--bg', '#0B1B33'), bg2: v('--bg-2', '#122648'), text: v('--text', '#F4EFE6'), dim: v('--text-dim', '#B8C3D6'),
    primary: v('--primary', '#FB4F14'), paper: v('--paper', '#F4EFE6'), ink: '#111111', gold: v('--gold', '#FFC845'),
  };
}

function wrap(ctx, text, maxW) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(ctx, text, box) {
  for (let size = 44; size >= 16; size -= 2) {
    ctx.font = `800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const lines = wrap(ctx, text, box);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length * size * 1.05 <= box && widest <= box) return { size, lines };
  }
  ctx.font = '800 16px "Barlow Condensed", "Arial Narrow", sans-serif';
  return { size: 16, lines: wrap(ctx, text, box) };
}

function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hgt, r);
  ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
  ctx.arcTo(x, y + hgt, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#111';
  ctx.stroke();
}

export async function drawCard(session) {
  await Promise.all(FONTS.map((f) => document.fonts?.load?.(f).catch(() => {})));
  const c = vars();
  const cfg = session.config;
  const ev = evaluate(session.board, session.marks, cfg.win);
  const won = new Set();
  for (const k of bingoKeys(ev)) for (const i of cellsForKey(k)) won.add(i);
  const { rank, of } = session.myRank();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background with a warm glow.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -80, 40, W / 2, -80, 900);
  glow.addColorStop(0, c.primary + '66');
  glow.addColorStop(1, c.primary + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header: the board logo if one is set, otherwise the wordmark.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const logo = BOARD_LOGO ? await loadImage(BOARD_LOGO) : null;
  if (logo) {
    const boxW = 880, boxH = 220;
    const scale = Math.min(boxW / logo.naturalWidth, boxH / logo.naturalHeight);
    const lw = logo.naturalWidth * scale, lh = logo.naturalHeight * scale;
    ctx.drawImage(logo, (W - lw) / 2, 30 + (boxH - lh) / 2, lw, lh);
  } else {
    ctx.fillStyle = c.primary;
    ctx.font = '800 42px "Barlow Condensed", sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '18px';
    ctx.fillText('GAMEDAY', W / 2 + 9, 92);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.save();
    ctx.translate(W / 2, 222);
    ctx.rotate(-0.045);
    ctx.font = '400 140px "Alfa Slab One", Georgia, serif';
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.35;
    ctx.fillText('BINGO', 0, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.primary;
    ctx.fillText('BINGO', 0, 7);
    ctx.fillStyle = c.paper;
    ctx.fillText('BINGO', 0, 0);
    ctx.restore();
  }
  ctx.fillStyle = c.dim;
  ctx.font = '800 38px "Barlow Condensed", sans-serif';
  const date = new Date(session.state.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  ctx.fillText(`${cfg.opp ? 'VS ' + cfg.opp.toUpperCase() + ' · ' : ''}${cfg.packName.toUpperCase()} · ${date.toUpperCase()}`, W / 2, 292, W - 120);

  // Board.
  const size = 820;
  const gap = 12;
  const x0 = (W - size) / 2;
  const y0 = 330;
  const cell = (size - gap * 4) / 5;
  const pos = (i) => ({ x: x0 + (i % 5) * (cell + gap), y: y0 + Math.floor(i / 5) * (cell + gap) });

  for (let i = 0; i < 25; i++) {
    const { x, y } = pos(i);
    ctx.save();
    ctx.translate(x + cell / 2, y + cell / 2);
    ctx.rotate(((seeded('tilt' + i)() - 0.5) * 1.2 * Math.PI) / 180);
    ctx.translate(-cell / 2, -cell / 2);
    if (won.has(i)) {
      roundRect(ctx, -8, -8, cell + 16, cell + 16, 16);
      ctx.fillStyle = c.gold;
      ctx.fill();
    }
    roundRect(ctx, 0, 0, cell, cell, 10);
    ctx.fillStyle = c.paper;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = c.ink;
    ctx.stroke();
    if (session.marks[i]) {
      const p = new Path2D(blotPath(seeded(`blot:${session.code}:${i}`)));
      ctx.save();
      ctx.translate(cell / 2, cell / 2);
      ctx.rotate(seeded('r' + i)() * Math.PI);
      ctx.scale(cell / 88, cell / 88);
      ctx.translate(-50, -50);
      ctx.globalAlpha = 0.66;
      ctx.fillStyle = c.primary;
      ctx.fill(p);
      ctx.restore();
    }
    ctx.restore();
  }

  // Winning lines: a gold stroke through the centers.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = c.gold;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 26;
  for (const li of ev.lines) {
    const cells = cellsForKey('L' + li);
    const a = pos(cells[0]);
    const b = pos(cells[4]);
    ctx.beginPath();
    ctx.moveTo(a.x + cell / 2, a.y + cell / 2);
    ctx.lineTo(b.x + cell / 2, b.y + cell / 2);
    ctx.stroke();
  }
  ctx.restore();

  // Text on top.
  for (let i = 0; i < 25; i++) {
    const { x, y } = pos(i);
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    if (i === CENTER) {
      star(ctx, cx, cy - 10, cell * 0.3, c.gold);
      ctx.fillStyle = c.ink;
      ctx.font = '800 26px "Barlow Condensed", sans-serif';
      ctx.fillText('FREE', cx, y + cell - 14);
      continue;
    }
    const text = fill(session.board[i].t, cfg);
    const { size: fs, lines } = fitText(ctx, text, cell - 22);
    ctx.fillStyle = c.ink;
    ctx.textBaseline = 'middle';
    const lh = fs * 1.05;
    lines.forEach((ln, k) => ctx.fillText(ln, cx, cy + (k - (lines.length - 1) / 2) * lh, cell - 16));
    ctx.textBaseline = 'alphabetic';
    if (session.marks[i]) {
      ctx.beginPath();
      ctx.arc(x + cell - 20, y + cell - 20, 13, 0, Math.PI * 2);
      ctx.fillStyle = c.ink;
      ctx.fill();
      ctx.strokeStyle = c.paper;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + cell - 26, y + cell - 20);
      ctx.lineTo(x + cell - 21, y + cell - 15);
      ctx.lineTo(x + cell - 13, y + cell - 25);
      ctx.stroke();
    }
  }

  // Score line.
  ctx.fillStyle = c.gold;
  ctx.font = '400 60px "Alfa Slab One", Georgia, serif';
  const scoreLine = `${ev.points} PTS · ${plural(ev.bingos, 'BINGO', 'BINGOS')}${of > 1 ? ` · #${rank} OF ${of}` : ''}`;
  ctx.fillText(scoreLine, W / 2, 1238, W - 80);
  ctx.fillStyle = c.dim;
  ctx.font = '600 28px "Inter", sans-serif';
  ctx.fillText(appUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1300, W - 80);

  return { canvas, ev, rank, of };
}

export function emojiGrid(session) {
  const ev = evaluate(session.board, session.marks, session.config.win);
  const won = new Set();
  for (const k of bingoKeys(ev)) for (const i of cellsForKey(k)) won.add(i);
  let out = '';
  for (let r = 0; r < 5; r++) {
    for (let col = 0; col < 5; col++) {
      const i = r * 5 + col;
      out += i === CENTER ? '⭐' : won.has(i) ? '🟨' : session.marks[i] ? '🟧' : '⬜';
    }
    out += '\n';
  }
  return out;
}

export function shareText(session) {
  const cfg = session.config;
  const ev = evaluate(session.board, session.marks, cfg.win);
  const { rank, of } = session.myRank();
  return `Gameday Bingo${cfg.opp ? ' vs ' + cfg.opp : ''} 🏈\n${emojiGrid(session)}${plural(ev.bingos, 'bingo')} · ${ev.points} pts${of > 1 ? ` · #${rank} of ${of}` : ''}`;
}

/** Build the card, then show a preview with Share / Save (share must run inside a tap). */
export async function shareCard(session) {
  const { canvas } = await drawCard(session);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], `gameday-bingo-${session.code}.png`, { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const text = shareText(session);
  const canFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));

  await sheet((close) => h('div', { class: 'center' },
    h('h2', null, 'Your card'),
    h('img', { src: url, alt: 'Your bingo card with score', style: { width: '100%', maxWidth: '360px', borderRadius: '12px', boxShadow: 'var(--shadow)' } }),
    h('div', { class: 'actions' },
      navigator.share ? h('button', {
        class: 'btn btn-primary btn-block',
        onclick: async () => {
          try {
            await navigator.share(canFiles ? { files: [file], text, title: 'Gameday Bingo' } : { text, url: appUrl(), title: 'Gameday Bingo' });
            close();
          } catch (e) {
            if (e?.name !== 'AbortError') say('Sharing didn’t work. Try Save image.', '⚠️');
          }
        },
      }, '📤 Share') : null,
      h('a', { class: 'btn btn-ghost btn-block', href: url, download: file.name }, '💾 Save image'),
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: async () => { if (await copyText(text + '\n' + appUrl())) say('Result copied', '📋'); },
      }, '📋 Copy result'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => close() }, 'Close'),
    ),
  ), { label: 'Share your card' });
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
