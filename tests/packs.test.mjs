import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { BUILTIN_PACKS, DEFAULT_PACKS_VERSION, PAST_FINGERPRINTS, isInjurySquare } = await import('../js/data/default-packs.js');
const { teamKey, eligibleSquares } = await import('../js/tags.js');
const { fingerprint, migrate, mergeDefaults, getPack, savePack } = await import('../js/packs.js');
const { bingoRate, TARGETS } = await import('../tools/simulate.mjs');
const { generateBoard, MIX } = await import('../js/board.js');
const store = await import('../js/store.js');

const all = BUILTIN_PACKS.flatMap((p) => p.squares);
const texts = (pool) => pool.map((s) => s.t);

test('content rule: no default square is about someone getting hurt', () => {
  for (const bad of ['Bo Nix ankle injury mentioned', 'Dobbins injured', 'Injury cart comes out', 'Star WR carted off', 'QB hurt on the play']) {
    assert.ok(isInjurySquare(bad), bad);
  }
  assert.ok(!isInjurySquare('Injury timeout'));
  const offenders = all.filter((s) => isInjurySquare(s.t)).map((s) => s.t);
  assert.deepEqual(offenders, []);
  for (const p of BUILTIN_PACKS) {
    const it = p.squares.filter((s) => s.t === 'Injury timeout');
    assert.equal(it.length, 1, p.name);
    assert.equal(it[0].r, 'C');
  }
});

test('likely calls are Common in both packs', () => {
  const calls = ['Defensive pass interference', 'Offensive pass interference', 'Intentional grounding', 'Offside',
    'Neutral zone infraction', 'Encroachment', 'Illegal formation', 'Illegal contact', 'Unnecessary roughness',
    'Facemask', 'Illegal block in the back', 'Personal foul', 'Illegal motion/shift', 'First down by penalty',
    'Punt', 'Timeout called', 'Measurement / chains brought out', 'Flag picked up / no-call'];
  for (const p of BUILTIN_PACKS) {
    for (const t of calls) assert.equal(p.squares.filter((s) => s.t === t && s.r === 'C').length, 1, `${p.name}: ${t}`);
    const seen = new Set();
    for (const s of p.squares) { const k = s.t.toLowerCase(); assert.ok(!seen.has(k), `duplicate ${s.t}`); seen.add(k); }
  }
});

test('opponent aliases', () => {
  for (const n of ['49ers', 'Niners', 'niners', 'San Francisco', 'SF', 'the Niners', 'San Francisco 49ers']) assert.equal(teamKey(n), '49ers', n);
  assert.equal(teamKey('Chiefs'), 'chiefs');
  assert.equal(teamKey('Kansas City'), 'chiefs');
});

test('Niners on Sunday afternoon: 49ers squares in, SNF and injury squares out', () => {
  const broncos = BUILTIN_PACKS[0].squares;
  const pool = eligibleSquares(broncos, { opp: 'Niners', broadcast: 'afternoon' });
  const t = texts(pool);
  assert.ok(t.includes('Kyle Shanahan shown looking stressed'));
  assert.ok(t.includes('Super Bowl XXIV brought up'));
  assert.ok(t.includes('Out-of-town score ticker shows a blowout'));
  for (const snf of ['Collinsworth mentions Mahomes', '“Here’s a guy”', 'IN… COME… PLETE!']) assert.ok(!t.includes(snf), snf);
  assert.ok(!t.some((x) => /collinsworth/i.test(x)));
  assert.ok(!pool.some((s) => isInjurySquare(s.t)));
  // Real boards drawn from that pool contain 49ers squares.
  const niners = new Set(pool.filter((s) => s.opponents).map((s) => s.t));
  let seen = 0;
  for (let i = 0; i < 200; i++) seen += generateBoard(pool, 'balanced', 'N' + i).filter((s) => s && niners.has(s.t)).length;
  assert.ok(seen > 0);

  const chiefs = texts(eligibleSquares(broncos, { opp: 'Chiefs', broadcast: 'snf' }));
  assert.ok(!chiefs.some((x) => /Shanahan|Kittle|Golden Gate/.test(x)));
  assert.ok(chiefs.includes('Collinsworth mentions Mahomes'));
  assert.ok(!chiefs.includes('Network promo for the late game'));
});

test('simulated bingo odds hit the targets (±5 points)', () => {
  const pool = eligibleSquares(BUILTIN_PACKS[0].squares, { opp: 'Niners', broadcast: 'afternoon' });
  for (const mix of Object.keys(MIX)) {
    const rate = bingoRate(pool, mix, 3000, 7);
    assert.ok(Math.abs(rate - TARGETS[mix]) <= 0.05, `${mix}: ${(rate * 100).toFixed(1)}%`);
  }
});

test('default pack versioning: unedited copies update, edited copies get a merge offer', () => {
  assert.ok(DEFAULT_PACKS_VERSION >= 2);
  for (const p of BUILTIN_PACKS) assert.notEqual(fingerprint(p.squares), PAST_FINGERPRINTS[p.builtin][1]);

  const old = [
    { id: 'a', t: 'Touchdown', r: 'C', c: 'Plays' },
    { id: 'b', t: 'Dobbins injured', r: 'R', c: 'Classic' },
    { id: 'c', t: 'Collinsworth mentions Mahomes', r: 'U', c: 'Classic' },
  ];
  const unedited = { id: 'broncos', builtin: 'broncos', name: 'Broncos Game Night', squares: old.map((s) => ({ ...s })), builtinVersion: 1, baseFp: fingerprint(old) };
  const edited = { id: 'any', builtin: 'any', name: 'My Any', squares: [...old.map((s) => ({ ...s })), { id: 'd', t: 'My own square', r: 'C', c: '' }], builtinVersion: 1, baseFp: fingerprint(old) };
  const packs = [unedited, edited];
  assert.ok(migrate(packs));
  assert.equal(packs[0].builtinVersion, DEFAULT_PACKS_VERSION);
  assert.equal(packs[0].squares.length, BUILTIN_PACKS[0].squares.length);
  assert.equal(packs[1].pendingMerge, DEFAULT_PACKS_VERSION);
  assert.equal(packs[1].squares.length, 4);

  store.set('packs', packs);
  const res = mergeDefaults('any');
  const merged = getPack('any');
  assert.equal(res.removed, 1);
  assert.ok(res.added > 50);
  assert.ok(merged.squares.some((s) => s.t === 'My own square'));
  assert.ok(!merged.squares.some((s) => isInjurySquare(s.t)));
  assert.deepEqual(merged.squares.find((s) => s.t === 'Collinsworth mentions Mahomes').broadcasts, undefined); // not in Any Game
  assert.ok(merged.squares.find((s) => s.t === 'Golden Gate Bridge shot').opponents.includes('49ers'));
  assert.equal(merged.pendingMerge, undefined);
  assert.ok(!migrate([merged]), 'no second offer');
  savePack(merged);
});
