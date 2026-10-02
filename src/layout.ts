import type { BarChartOptions, BarDatum, DatumValue } from './types.js';

export function valuesOf(datum: BarDatum): DatumValue[] {
  return Array.isArray(datum.value) ? datum.value : [datum.value];
}

/** The values that exist; `null` (no value yet) and absent entries take no space on the scale. */
function present(values: DatumValue[]): number[] {
  return values.filter((value): value is number => typeof value === 'number');
}

export function validate(options: BarChartOptions): void {
  if (!Array.isArray(options.data)) throw new TypeError('Charto: data must be an array.');
  for (const datum of options.data) {
    if (!datum || typeof datum.label !== 'string') throw new TypeError('Charto: each datum needs a string label.');
    if (valuesOf(datum).some(value => value !== null && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e100))) {
      throw new TypeError('Charto: values must be null or finite numbers between -1e100 and 1e100.');
    }
  }
  const minimumHeight = options.compact ? 32 : 120;
  if (options.height !== undefined && (!Number.isFinite(options.height) || options.height < minimumHeight)) {
    throw new RangeError(`Charto: height must be at least ${minimumHeight}.`);
  }
  if (options.radius !== undefined && (!Number.isFinite(options.radius) || options.radius < 0)) {
    throw new RangeError('Charto: radius must be a non-negative number.');
  }
  for (const key of ['min', 'max'] as const) {
    if (options[key] !== undefined && (!Number.isFinite(options[key]) || Math.abs(options[key]!) > 1e100)) {
      throw new RangeError(`Charto: ${key} must be a finite number between -1e100 and 1e100.`);
    }
  }
  if (options.missing !== undefined && !['placeholder', 'none'].includes(options.missing)) {
    throw new TypeError("Charto: missing must be 'placeholder' or 'none'.");
  }
  for (const series of options.series ?? []) {
    if (series?.pattern !== undefined && !['solid', 'hatched'].includes(series.pattern)) {
      throw new TypeError("Charto: series pattern must be 'solid' or 'hatched'.");
    }
  }
  if (options.min !== undefined && options.max !== undefined && options.min >= options.max) {
    throw new RangeError('Charto: min must be less than max.');
  }
}

export function getDomain(data: BarDatum[], stacked = false, bounds: { min?: number; max?: number } = {}): { min: number; max: number; ticks: number[] } {
  let low = 0;
  let high = 0;
  for (const datum of data) {
    const values = present(valuesOf(datum));
    if (stacked) {
      low = Math.min(low, values.reduce((sum, value) => sum + Math.min(0, value), 0));
      high = Math.max(high, values.reduce((sum, value) => sum + Math.max(0, value), 0));
    } else {
      for (const value of values) { low = Math.min(low, value); high = Math.max(high, value); }
    }
  }
  low = bounds.min ?? low;
  high = bounds.max ?? high;
  if (low >= high) {
    if (bounds.max !== undefined) low = high - Math.max(1, Math.abs(high) * 0.1);
    else high = low + Math.max(1, Math.abs(low) * 0.1);
  }
  const rough = Math.max(Number.MIN_VALUE, (high - low) / 4);
  const power = Math.max(Number.MIN_VALUE, 10 ** Math.floor(Math.log10(rough)));
  const fraction = rough / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
  const min = bounds.min ?? Number((Math.floor(low / step) * step).toPrecision(15));
  const max = bounds.max ?? Number((Math.ceil(high / step) * step).toPrecision(15));
  const start = Math.ceil(min / step) * step;
  const ticks = Array.from({ length: Math.min(20, Math.max(0, Math.round((max - start) / step) + 1)) }, (_, index) => Number((start + step * index).toPrecision(15)))
    .filter(value => value > min + step * 0.2 && value < max - step * 0.2);
  ticks.unshift(min);
  ticks.push(max);
  return { min, max, ticks: [...new Set(ticks)] };
}

/** Where each value starts and ends. A `null` is an empty segment where the stack stands. */
export function segments(values: DatumValue[], stacked: boolean): { start: number; end: number }[] {
  let positive = 0;
  let negative = 0;
  return values.map(value => {
    if (value === null) {
      const at = stacked ? positive : 0;
      return { start: at, end: at };
    }
    const start = stacked ? (value >= 0 ? positive : negative) : 0;
    const end = start + value;
    if (stacked) { if (value >= 0) positive = end; else negative = end; }
    return { start, end };
  });
}
