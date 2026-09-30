import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDomain, segments, validate } from '../src/layout.ts';

test('positive data includes zero and does not clip the tallest bar', () => {
  const domain = getDomain([{ label: 'A', value: 124 }, { label: 'B', value: 359 }]);
  assert.equal(domain.min, 0);
  assert.ok(domain.max >= 359);
  assert.ok(domain.ticks.length >= 3 && domain.ticks.length <= 7);
});
test('all-negative data ends at zero', () => {
  const domain = getDomain([{ label: 'A', value: -13 }, { label: 'B', value: -49 }]);
  assert.equal(domain.max, 0);
  assert.ok(domain.min <= -49);
});
test('mixed signs keep zero on the tick grid', () => {
  const domain = getDomain([{ label: 'A', value: [-40, 80, 13] }]);
  assert.ok(domain.min <= -40 && domain.max >= 80);
  assert.ok(domain.ticks.includes(0));
});
test('stacked domain sums each sign separately', () => {
  const domain = getDomain([{ label: 'A', value: [80, -30, 40, -20] }], true);
  assert.ok(domain.max >= 120 && domain.min <= -50);
  assert.deepEqual(segments([80, -30, 40, -20], true), [
    { start: 0, end: 80 }, { start: 0, end: -30 }, { start: 80, end: 120 }, { start: -30, end: -50 },
  ]);
});
test('grouped series share a zero baseline', () => {
  assert.deepEqual(segments([80, -30, 40], false), [{ start: 0, end: 80 }, { start: 0, end: -30 }, { start: 0, end: 40 }]);
});
test('empty and all-zero data have a usable domain', () => {
  for (const data of [[], [{ label: 'Zero', value: 0 }]]) {
    const domain = getDomain(data);
    assert.equal(domain.min, 0);
    assert.ok(domain.max > 0);
    assert.ok(domain.ticks.every(Number.isFinite));
  }
});
test('decimal tick labels avoid floating point residue', () => {
  const domain = getDomain([{ label: 'A', value: 0.3 }]);
  assert.deepEqual(domain.ticks, [0, 0.1, 0.2, 0.3]);
});
test('small and large values produce finite coordinates', () => {
  for (const value of [Number.MIN_VALUE, 1e-200, 0.000031, 9.5e99]) {
    const domain = getDomain([{ label: 'A', value }]);
    assert.ok(Number.isFinite(domain.min) && Number.isFinite(domain.max));
    assert.ok(domain.max > domain.min);
    assert.ok(domain.ticks.every(Number.isFinite));
  }
});
test('invalid inputs fail early with useful messages', () => {
  for (const value of [NaN, Infinity, -Infinity, 1e101]) {
    assert.throws(() => validate({ data: [{ label: 'Bad', value }] }), /finite numbers/);
  }
  assert.throws(() => validate({ data: [], height: 40 }), /height/);
  assert.throws(() => validate({ data: [], radius: -1 }), /radius/);
});
test('valid empty and multi-series data are accepted', () => {
  assert.doesNotThrow(() => validate({ data: [] }));
  assert.doesNotThrow(() => validate({ data: [{ label: 'A', value: [3, 0, -4] }, { label: 'B', value: [] }] }));
});
