export interface Point { x: number; y: number }

const coordinate = (value: number): string => String(Number(value.toFixed(3)));
const pair = (point: Point): string => `${coordinate(point.x)},${coordinate(point.y)}`;

/** The control points stay within each segment's endpoints, so curves cannot overshoot the data. */
export function linePath(points: Point[], curve: 'linear' | 'smooth'): string {
  if (!points.length) return '';
  const start = `M${pair(points[0])}`;
  if (curve === 'linear' || points.length < 3) {
    return start + points.slice(1).map(point => `L${pair(point)}`).join('');
  }
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x));
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[index - 1];
    const before = slopes[index - 1];
    const after = slopes[index];
    return Math.sign(before) === Math.sign(after) ? Math.sign(before) * Math.min(Math.abs(before), Math.abs(after)) : 0;
  });
  return start + points.slice(1).map((point, index) => {
    const previous = points[index];
    const third = (point.x - previous.x) / 3;
    const a = { x: previous.x + third, y: previous.y + tangents[index] * third };
    const b = { x: point.x - third, y: point.y - tangents[index + 1] * third };
    return `C${pair(a)} ${pair(b)} ${pair(point)}`;
  }).join('');
}
