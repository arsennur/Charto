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
test('fixed bounds stay exact and produce readable ticks inside the range', () => {
  for (const [min, max] of [[0, 100], [17, 93], [-100, -10], [-30, 80], [0.01, 0.09], [1e99, 1.1e99]]) {
    const domain = getDomain([{ label: 'A', value: [-500, 500] }], true, { min, max });
    assert.equal(domain.min, min);
    assert.equal(domain.max, max);
    assert.equal(domain.ticks[0], min);
    assert.equal(domain.ticks.at(-1), max);
    assert.ok(domain.ticks.every(value => Number.isFinite(value) && value >= min && value <= max));
    assert.ok(domain.ticks.length >= 2 && domain.ticks.length <= 10);
  }
});
test('single bounds adapt the automatic end even when all data is outside', () => {
  const data = [{ label: 'A', value: 20 }];
  const lower = getDomain(data, false, { min: 50 });
  assert.equal(lower.min, 50);
  assert.ok(lower.max > 50);
  const upper = getDomain(data, false, { max: -50 });
  assert.equal(upper.max, -50);
  assert.ok(upper.min < -50);
  const empty = getDomain([], false, { min: 20, max: 100 });
  assert.equal(empty.min, 20);
  assert.equal(empty.max, 100);
});
test('scale bounds reject invalid values and compact mode permits small heights', () => {
  for (const limits of [{ min: NaN }, { max: Infinity }, { min: -1e101 }, { min: 20, max: 10 }, { min: 10, max: 10 }]) {
    assert.throws(() => validate({ data: [], ...limits }), /min|max/);
  }
  assert.doesNotThrow(() => validate({ data: [], compact: true, height: 32 }));
  assert.throws(() => validate({ data: [], compact: true, height: 31 }), /height/);
});
test('null is no value: it takes no space on the scale and is an empty segment', () => {
  const domain = getDomain([{ label: 'A', value: null }, { label: 'B', value: [40, null] }]);
  assert.equal(domain.min, 0);
  assert.ok(domain.max >= 40 && domain.max < 80);
  assert.deepEqual(getDomain([{ label: 'A', value: [30, null, 20] }], true).max >= 50, true);
  assert.deepEqual(segments([30, null, 20], true), [{ start: 0, end: 30 }, { start: 30, end: 30 }, { start: 30, end: 50 }]);
  assert.deepEqual(segments([30, null], false), [{ start: 0, end: 30 }, { start: 0, end: 0 }]);
  assert.doesNotThrow(() => validate({ data: [{ label: 'A', value: null }, { label: 'B', value: [1, null] }] }));
  assert.throws(() => validate({ data: [{ label: 'A', value: undefined as unknown as number }] }), /values/);
});
test('missing and pattern options are validated', () => {
  assert.doesNotThrow(() => validate({ data: [], missing: 'none', series: [{ name: 'P', pattern: 'hatched' }] }));
  assert.throws(() => validate({ data: [], missing: 'skip' as 'none' }), /missing/);
  assert.throws(() => validate({ data: [], series: [{ name: 'P', pattern: 'dots' as 'hatched' }] }), /pattern/);
});
test('whole-number data gets whole-number ticks', () => {
  for (const top of [1, 2, 3, 7, 25, 60]) {
    const domain = getDomain([{ label: 'A', value: top }, { label: 'B', value: 0 }]);
    assert.ok(domain.ticks.every(Number.isInteger), `fractional tick for max ${top}: ${domain.ticks}`);
    assert.ok(domain.max >= top);
  }
  assert.deepEqual(getDomain([{ label: 'A', value: 0 }]).ticks, [0, 1]);
  assert.ok(getDomain([{ label: 'A', value: [1, null, 2] }], true).ticks.every(Number.isInteger));
  assert.ok(!getDomain([{ label: 'A', value: 0.3 }]).ticks.every(Number.isInteger), 'decimal data lost its fine ticks');
});
