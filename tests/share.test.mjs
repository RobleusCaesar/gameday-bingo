import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { parseJoin, sanitizeConfig, sanitizeStandings, fill } = await import('../js/share.js');

const squares = Array.from({ length: 30 }, (_, i) => ({ t: 'Square ' + i, r: ['C', 'U', 'R'][i % 3] }));

test('parseJoin handles hashes, full URLs and payloads', () => {
  assert.deepEqual(parseJoin('#/join/ABCDE'), { code: 'ABCDE', payload: null });
  assert.deepEqual(parseJoin('https://x.github.io/gameday-bingo/#/join/K7M2P~N4Ig$+-x'), { code: 'K7M2P', payload: 'N4Ig$+-x' });
  assert.deepEqual(parseJoin('abcde'), { code: 'ABCDE', payload: null });
  assert.equal(parseJoin('#/join/AB0DE'), null); // 0 isn't in the alphabet
  assert.equal(parseJoin('hello world'), null);
});

test('sanitizeConfig rejects junk and clamps fields', () => {
  assert.equal(sanitizeConfig(null), null);
  assert.equal(sanitizeConfig({ code: 'ABCDE', squares: squares.slice(0, 10) }), null);
  assert.equal(sanitizeConfig({ code: 'nope', squares }), null);
  const cfg = sanitizeConfig({
    code: 'ABCDE',
    squares: [...squares, { t: 'x'.repeat(500), r: 'Z' }, { t: '', r: 'C' }, null],
    opp: 'O'.repeat(100),
    win: { corners: 1, x: 0 },
    mix: 'weird',
    hostName: '<b>Rob</b>',
  });
  assert.equal(cfg.squares.length, 31);
  assert.equal(cfg.squares[30].t.length, 80);
  assert.equal(cfg.squares[30].r, 'C');
  assert.equal(cfg.opp.length, 30);
  assert.deepEqual(cfg.win, { corners: true, x: false, blackout: false });
  assert.equal(cfg.mix, 'balanced');
  assert.equal(cfg.hostName, '<b>Rob</b>'); // rendered via textContent, never innerHTML
});

test('sanitizeStandings clamps numbers', () => {
  const out = sanitizeStandings([{ pid: 'a', name: 'A', points: 1e9, bingos: -3, marks: 7 }, 'junk']);
  assert.equal(out[0].points, 99999);
  assert.equal(out[0].bingos, 0);
  assert.equal(out[1].name, 'Player');
});

test('fill replaces tokens', () => {
  assert.equal(fill('Sad {OPP} fan shown', { opp: 'Chiefs' }), 'Sad Chiefs fan shown');
  assert.equal(fill('{TEAM} legend', {}), 'Home team legend');
});

test('service worker precaches every app file', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const root = new URL('..', import.meta.url).pathname;
  const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
    const rel = join(dir, f);
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
  const files = [...walk('js'), ...walk('css'), ...walk('icons')];
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `sw.js SHELL is missing ${f}`);
});
