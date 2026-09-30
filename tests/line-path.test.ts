import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linePath, type Point } from '../src/line-path.ts';

test('sharp lines connect the original points with straight segments', () => {
  assert.equal(linePath([{ x: 0, y: 30 }, { x: 50, y: 10 }, { x: 100, y: 40 }], 'linear'), 'M0,30L50,10L100,40');
});

test('empty, single-point and two-point lines have no invalid curves', () => {
  assert.equal(linePath([], 'smooth'), '');
  assert.equal(linePath([{ x: 42, y: 9 }], 'smooth'), 'M42,9');
  assert.equal(linePath([{ x: 0, y: 3 }, { x: 50, y: 7 }], 'smooth'), 'M0,3L50,7');
});

function cubicSegments(points: Point[]): number[][] {
  return linePath(points, 'smooth').split('C').slice(1).map(segment => segment.trim().split(/[ ,]+/).map(Number));
}

test('smooth curves pass through every original data point', () => {
  const points = [{ x: 0, y: 20 }, { x: 40, y: 60 }, { x: 95, y: 10 }, { x: 140, y: 40 }];
  cubicSegments(points).forEach((curve, index) => {
    assert.deepEqual(curve.slice(-2), [points[index + 1].x, points[index + 1].y]);
  });
});

test('curves stay within neighboring values through peaks, troughs and flat sections', () => {
  for (const values of [[0, 90, 1, 70], [-20, -80, 0, 60], [30, 30, 30, 30], [0, 2, 80, 82], [20, 20, 90, 90]]) {
    const points = values.map((y, i) => ({ x: i * 60, y }));
    cubicSegments(points).forEach(([x1, y1, x2, y2, x3, y3], index) => {
      const from = points[index];
      const min = Math.min(from.y, y3);
      const max = Math.max(from.y, y3);
      assert.ok(x1 > from.x && x2 > x1 && x3 > x2);
      for (let step = 0; step <= 100; step++) {
        const t = step / 100;
        const y = (1 - t) ** 3 * from.y + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y3;
        assert.ok(y >= min - 0.000001 && y <= max + 0.000001, `Curve overshot ${min}…${max}: ${y}`);
      }
    });
  }
});

test('smooth joins have matching incoming and outgoing slopes', () => {
  const points = [{ x: 0, y: 2 }, { x: 60, y: 20 }, { x: 120, y: 50 }, { x: 180, y: 25 }];
  const curves = cubicSegments(points);
  for (let index = 0; index < curves.length - 1; index++) {
    const [, , x2, y2, x3, y3] = curves[index];
    const [nextX, nextY] = curves[index + 1];
    assert.ok(Math.abs((y3 - y2) / (x3 - x2) - (nextY - y3) / (nextX - x3)) < 0.001);
  }
});
