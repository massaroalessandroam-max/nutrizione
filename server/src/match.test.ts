import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict, verdictOf, score, pointsForFoods } from './match.js';

// Mese fisso (luglio) per ogni test che non testa esplicitamente la
// stagionalità: 'Mirtilli' è nel calendario stagionale (seasonal.ts) ed è
// in stagione a luglio, così il risultato non dipende dalla data reale in
// cui gira la suite.
const JULY = { month: 7 };

test('verdict: matches a recommended food', () => {
  assert.equal(verdict('Yogurt greco', JULY), 'good');
  assert.equal(verdict('salmone alla griglia', JULY), 'good');
});

test('verdict: matches a discouraged food', () => {
  assert.equal(verdict('Pizza margherita', JULY), 'bad');
  assert.equal(verdict('birra', JULY), 'bad');
});

test('verdict: unlisted food falls back to ok', () => {
  assert.equal(verdict('Formaggio grana', JULY), 'ok');
});

test('verdict: is case-insensitive and trims whitespace', () => {
  assert.equal(verdict('  YOGURT GRECO  ', JULY), 'good');
});

test('verdict: a food from the patient\'s own Nemis plan wins over the generic lists', () => {
  // "Pizza" sarebbe normalmente 'bad' (lista SCONSIGLIATI), ma se è nel
  // piano del paziente ha priorità.
  const v = verdictOf('Pizza integrale fatta in casa', { planFoods: ['Pizza integrale fatta in casa'], month: 7 });
  assert.equal(v.tone, 'good');
  assert.equal(v.reason, 'plan');
});

test('verdict: seasonal produce is good in season, bad out of season', () => {
  // Le fragole sono in stagione ad aprile-giugno, non a dicembre.
  assert.deepEqual(verdictOf('fragole', { month: 5 }), { tone: 'good', reason: 'season-in' });
  assert.deepEqual(verdictOf('fragole', { month: 12 }), { tone: 'bad', reason: 'season-out' });
});

test('verdict: seasonal check does not apply to non-produce foods', () => {
  assert.equal(verdictOf('Pizza', { month: 12 }).reason, 'list');
});

test('score: no foods logged yields a neutral placeholder', () => {
  assert.deepEqual(score([]), { label: '—', tone: 'ok' });
});

test('score: all good foods, no bad ones -> Buona scelta', () => {
  const s = score(['Yogurt greco', 'Mirtilli', 'Avena'], JULY);
  assert.deepEqual(s, { label: 'Buona scelta', tone: 'good' });
});

test('score: one bad food (and at least one good) still counts as Buona scelta', () => {
  // Matches the prototype's rule: only bad===0 && good>=1 counts as "good",
  // a single bad food alone (no good) should NOT be "Buona scelta".
  const s = score(['Formaggio grana'], JULY); // ok only, no good, no bad
  assert.equal(s.tone, 'ok');
});

test('score: two or more bad foods -> Da rivedere', () => {
  const s = score(['Pizza', 'Birra', 'Yogurt greco'], JULY);
  assert.deepEqual(s, { label: 'Da rivedere', tone: 'bad' });
});

test('score: exactly one bad food and no good foods -> Nel complesso ok', () => {
  const s = score(['Pizza'], JULY);
  assert.deepEqual(s, { label: 'Nel complesso ok', tone: 'ok' });
});

test('pointsForFoods: sums per-food points by verdict (good=15, ok=8, bad=3)', () => {
  assert.equal(pointsForFoods(['Yogurt greco'], JULY), 15);
  assert.equal(pointsForFoods(['Formaggio grana'], JULY), 8);
  assert.equal(pointsForFoods(['Pizza'], JULY), 3);
  assert.equal(pointsForFoods(['Yogurt greco', 'Pizza'], JULY), 18);
  assert.equal(pointsForFoods([]), 0);
});
