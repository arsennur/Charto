import type { ChartColors } from './types.js';

export const NS = 'http://www.w3.org/2000/svg';
export const palette = ['#27bd83', '#9066f4', '#fa4768', '#ff9e24', '#3982f7'];
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const exact = new Intl.NumberFormat('en', { maximumSignificantDigits: 12 });
/** A number short enough for an axis or a label. */
export const shortNumber = (value: number): string => value !== 0 && Math.abs(value) < 0.01 ? value.toExponential(1) : compact.format(value);
const themes: Record<'light' | 'dark', ChartColors> = {
  light: { text: '#8a8a93', strong: '#27272a', grid: '#e4e4e7', background: '#ffffff', tooltip: '#18181b', tooltipText: '#ffffff' },
  dark: { text: '#a1a1aa', strong: '#f4f4f5', grid: '#3f3f46', background: '#18181b', tooltip: '#f4f4f5', tooltipText: '#18181b' },
};

// Colours are written as inline style, not as presentation attributes, so a
// colour can be a CSS variable (`var(--token)`) in every browser and follows the
// page's theme without a re-render. toSVG() resolves them back to attributes.
export const PAINT = new Set(['fill', 'stroke', 'stop-color']);

export function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (PAINT.has(key)) node.style.setProperty(key, String(value));
    else node.setAttribute(key, String(value));
  }
  return node;
}

export function themeColors(options: { theme?: 'light' | 'dark'; colors?: Partial<ChartColors> }): ChartColors {
  const overrides = Object.entries(options.colors ?? {}).filter(([, value]) => value !== undefined);
  return { ...themes[options.theme ?? 'light'], ...Object.fromEntries(overrides) };
}

export function svgText(text: string, x: number, y: number, attributes: Record<string, string | number> = {}): SVGTextElement {
  const node = svgElement('text', { x, y, 'font-size': 11, ...attributes });
  node.textContent = text;
  return node;
}

export function shorten(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, Math.max(1, length - 1))}…` : text;
}

/** One stripe pattern per colour, shared by every hatched mark that wears it. */
export function hatches(definitions: SVGDefsElement, prefix: string): (color: string) => string {
  const ids = new Map<string, string>();
  return color => {
    let id = ids.get(color);
    if (!id) {
      id = `${prefix}-hatch-${ids.size}`;
      const pattern = svgElement('pattern', { id, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' });
      pattern.append(svgElement('rect', { width: 2, height: 6, fill: color }));
      definitions.append(pattern);
      ids.set(color, id);
    }
    return `url(#${id})`;
  };
}

/** The checks every chart type shares. */
export function validateChrome(options: { tooltip?: unknown; colors?: unknown; onClick?: unknown }): void {
  if (options.tooltip !== undefined && typeof options.tooltip !== 'boolean' && typeof options.tooltip !== 'function') {
    throw new TypeError('Charto: tooltip must be a boolean or a text formatter.');
  }
  if (options.colors !== undefined && (typeof options.colors !== 'object' || options.colors === null
    || Object.values(options.colors).some(value => value !== undefined && typeof value !== 'string'))) {
    throw new TypeError('Charto: colors must be an object of CSS colour strings.');
  }
  if (options.onClick !== undefined && typeof options.onClick !== 'function') {
    throw new TypeError('Charto: onClick must be a function.');
  }
}
