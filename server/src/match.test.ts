import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict, score, pointsForFoods } from './match.js';

test('verdict: matches a recommended food', () => {
  assert.equal(verdict('Yogurt greco'), 'good');
  assert.equal(verdict('salmone alla griglia'), 'good');
});

test('verdict: matches a discouraged food', () => {
  assert.equal(verdict('Pizza margherita'), 'bad');
  assert.equal(verdict('birra'), 'bad');
});

test('verdict: unlisted food falls back to ok', () => {
  assert.equal(verdict('Formaggio grana'), 'ok');
});

test('verdict: is case-insensitive and trims whitespace', () => {
  assert.equal(verdict('  YOGURT GRECO  '), 'good');
});

test('score: no foods logged yields a neutral placeholder', () => {
  assert.deepEqual(score([]), { label: '—', tone: 'ok' });
});

test('score: all good foods, no bad ones -> Buona scelta', () => {
  const s = score(['Yogurt greco', 'Mirtilli', 'Avena']);
  assert.deepEqual(s, { label: 'Buona scelta', tone: 'good' });
});

test('score: one bad food (and at least one good) still counts as Buona scelta', () => {
  // Matches the prototype's rule: only bad===0 && good>=1 counts as "good",
  // a single bad food alone (no good) should NOT be "Buona scelta".
  const s = score(['Formaggio grana']); // ok only, no good, no bad
  assert.equal(s.tone, 'ok');
});

test('score: two or more bad foods -> Da rivedere', () => {
  const s = score(['Pizza', 'Birra', 'Yogurt greco']);
  assert.deepEqual(s, { label: 'Da rivedere', tone: 'bad' });
});

test('score: exactly one bad food and no good foods -> Nel complesso ok', () => {
  const s = score(['Pizza']);
  assert.deepEqual(s, { label: 'Nel complesso ok', tone: 'ok' });
});

test('pointsForFoods: sums per-food points by verdict (good=15, ok=8, bad=3)', () => {
  assert.equal(pointsForFoods(['Yogurt greco']), 15);
  assert.equal(pointsForFoods(['Formaggio grana']), 8);
  assert.equal(pointsForFoods(['Pizza']), 3);
  assert.equal(pointsForFoods(['Yogurt greco', 'Pizza']), 18);
  assert.equal(pointsForFoods([]), 0);
});
