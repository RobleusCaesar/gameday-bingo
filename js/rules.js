// Lines, patterns and scoring for a 5×5 board. Cell 12 is the FREE center.

export const SIZE = 5;
export const CENTER = 12;
export const POINTS = { C: 1, U: 2, R: 3 };
export const BONUS = { line: 10, corners: 10, x: 20, blackout: 50 };

const rows = [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c));
const cols = [0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c));
const diags = [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];

/** All 12 lines: 5 rows, 5 columns, 2 diagonals. */
export const LINES = [...rows, ...cols, ...diags];
export const LINE_NAMES = [
  'Row 1', 'Row 2', 'Row 3', 'Row 4', 'Row 5',
  'Column B', 'Column I', 'Column N', 'Column G', 'Column O',
  'Diagonal', 'Diagonal',
];
export const CORNERS = [0, 4, 20, 24];
export const X_CELLS = [...new Set([...diags[0], ...diags[1]])];

/**
 * Evaluate a board.
 * @param {Array<{r:string}|null>} board 25 cells (null = FREE)
 * @param {boolean[]} marks 25 flags
 * @param {{corners?:boolean,x?:boolean,blackout?:boolean}} win enabled patterns
 */
export function evaluate(board, marks, win = {}) {
  const lines = [];
  const near = [];
  LINES.forEach((line, i) => {
    const missing = line.filter((c) => !marks[c]);
    if (missing.length === 0) lines.push(i);
    else if (missing.length === 1) near.push({ line: i, cell: missing[0] });
  });
  const corners = !!win.corners && CORNERS.every((c) => marks[c]);
  const x = !!win.x && X_CELLS.every((c) => marks[c]);
  const blackout = !!win.blackout && marks.every(Boolean);

  let squarePoints = 0;
  board.forEach((sq, i) => {
    if (sq && marks[i]) squarePoints += POINTS[sq.r] || 1;
  });
  const bonus = lines.length * BONUS.line
    + (corners ? BONUS.corners : 0)
    + (x ? BONUS.x : 0)
    + (blackout ? BONUS.blackout : 0);

  const bingos = lines.length + (corners ? 1 : 0) + (x ? 1 : 0) + (blackout ? 1 : 0);
  return { lines, near, corners, x, blackout, bingos, squarePoints, bonus, points: squarePoints + bonus };
}

/** Keys identifying each completed bingo, e.g. "L3", "corners". */
export function bingoKeys(ev) {
  const keys = ev.lines.map((i) => 'L' + i);
  if (ev.corners) keys.push('corners');
  if (ev.x) keys.push('x');
  if (ev.blackout) keys.push('blackout');
  return keys;
}

export function cellsForKey(key) {
  if (key.startsWith('L')) return LINES[+key.slice(1)];
  if (key === 'corners') return CORNERS;
  if (key === 'x') return X_CELLS;
  if (key === 'blackout') return [...Array(25).keys()];
  return [];
}

export function labelForKey(key) {
  if (key.startsWith('L')) return 'Line';
  if (key === 'corners') return 'Four Corners';
  if (key === 'x') return 'X';
  if (key === 'blackout') return 'Blackout';
  return 'Bingo';
}

export function marksToBits(marks) {
  let n = 0;
  marks.forEach((m, i) => { if (m) n |= 1 << i; });
  return n >>> 0;
}

export function bitsToMarks(bits) {
  const out = [];
  for (let i = 0; i < 25; i++) out.push(!!((bits >>> i) & 1));
  return out;
}

/** Leaderboard order: bingos, then points, then whoever got there first. */
export function compareStandings(a, b) {
  return (b.bingos || 0) - (a.bingos || 0)
    || (b.points || 0) - (a.points || 0)
    || (a.lastEventAt || Infinity) - (b.lastEventAt || Infinity);
}
