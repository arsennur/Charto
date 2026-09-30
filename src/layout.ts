import type { BarChartOptions, BarDatum } from './types.js';

export function valuesOf(datum: BarDatum): number[] {
  return Array.isArray(datum.value) ? datum.value : [datum.value];
}

export function validate(options: BarChartOptions): void {
  if (!Array.isArray(options.data)) throw new TypeError('Charto: data must be an array.');
  for (const datum of options.data) {
    if (!datum || typeof datum.label !== 'string') throw new TypeError('Charto: each datum needs a string label.');
    if (valuesOf(datum).some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e100)) {
      throw new TypeError('Charto: values must be finite numbers between -1e100 and 1e100.');
    }
  }
  if (options.height !== undefined && (!Number.isFinite(options.height) || options.height < 120)) {
    throw new RangeError('Charto: height must be at least 120.');
  }
  if (options.radius !== undefined && (!Number.isFinite(options.radius) || options.radius < 0)) {
    throw new RangeError('Charto: radius must be a non-negative number.');
  }
}

export function getDomain(data: BarDatum[], stacked = false): { min: number; max: number; ticks: number[] } {
  let low = 0;
  let high = 0;
  for (const datum of data) {
    const values = valuesOf(datum);
    if (stacked) {
      low = Math.min(low, values.reduce((sum, value) => sum + Math.min(0, value), 0));
      high = Math.max(high, values.reduce((sum, value) => sum + Math.max(0, value), 0));
    } else {
      for (const value of values) { low = Math.min(low, value); high = Math.max(high, value); }
    }
  }
  if (low === high) high = 1;
  const rough = Math.max(Number.MIN_VALUE, (high - low) / 4);
  const power = Math.max(Number.MIN_VALUE, 10 ** Math.floor(Math.log10(rough)));
  const fraction = rough / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => Number((min + step * index).toPrecision(12)));
  return { min, max, ticks };
}

export function segments(values: number[], stacked: boolean): { start: number; end: number }[] {
  let positive = 0;
  let negative = 0;
  return values.map(value => {
    const start = stacked ? (value >= 0 ? positive : negative) : 0;
    const end = start + value;
    if (stacked) { if (value >= 0) positive = end; else negative = end; }
    return { start, end };
  });
}
