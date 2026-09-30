import { getDomain, segments, validate, valuesOf } from './layout.ts';
import { linePath, type Point } from './line-path.ts';
import type { BarChart, BarChartOptions, Chart, LineChart, LineChartOptions } from './types.js';
export type { BarChart, BarChartOptions, BarDatum, BarSeries, ChartClickEvent, LineChart, LineChartOptions, LineDatum, LineSeries } from './types.js';

type Options = BarChartOptions & LineChartOptions;

const NS = 'http://www.w3.org/2000/svg';
let chartSequence = 0;
const palette = ['#27bd83', '#9066f4', '#fa4768', '#ff9e24', '#3982f7'];
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const exact = new Intl.NumberFormat('en', { maximumSignificantDigits: 12 });
const colors = {
  light: { text: '#8a8a93', strong: '#27272a', grid: '#e4e4e7', background: '#ffffff', tooltip: '#18181b', tooltipText: '#ffffff' },
  dark: { text: '#a1a1aa', strong: '#f4f4f5', grid: '#3f3f46', background: '#18181b', tooltip: '#f4f4f5', tooltipText: '#18181b' },
};

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function svgText(text: string, x: number, y: number, attributes: Record<string, string | number> = {}): SVGTextElement {
  const node = svgElement('text', { x, y, 'font-size': 11, ...attributes });
  node.textContent = text;
  return node;
}

function shorten(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, Math.max(1, length - 1))}…` : text;
}

function withDefaults(input: Options, isLine: boolean): Options {
  return {
    ...input,
    height: input.height ?? 320,
    orientation: input.orientation ?? 'vertical',
    mode: input.mode ?? 'grouped',
    theme: input.theme ?? 'light',
    grid: input.grid ?? true,
    labels: input.labels ?? true,
    values: input.values ?? false,
    animate: input.animate ?? true,
    radius: input.radius ?? 5,
    label: input.label ?? (isLine ? 'Line chart' : 'Bar chart'),
    curve: input.curve ?? 'smooth',
    strokeWidth: input.strokeWidth ?? 3,
    points: input.points ?? true,
  };
}

function validateChart(options: Options, isLine: boolean): void {
  validate(options);
  if (options.onClick !== undefined && typeof options.onClick !== 'function') {
    throw new TypeError('Charto: onClick must be a function.');
  }
  if (isLine && options.curve !== undefined && !['linear', 'smooth'].includes(options.curve)) {
    throw new TypeError("Charto: curve must be 'linear' or 'smooth'.");
  }
  if (isLine && options.strokeWidth !== undefined && (!Number.isFinite(options.strokeWidth) || options.strokeWidth <= 0 || options.strokeWidth > 20)) {
    throw new RangeError('Charto: strokeWidth must be greater than 0 and at most 20.');
  }
}

function createChart(target: string | HTMLElement, initial: Options, isLine: boolean): Chart<Options> {
  const host = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!host) throw new Error('Charto: target element was not found.');
  validateChart(initial, isLine);
  let options = withDefaults(initial, isLine);
  const chartId = `charto-${++chartSequence}`;
  let destroyed = false;
  let renderedWidth = 0;
  let frame = 0;
  let animations: Animation[] = [];
  let svg: SVGSVGElement;
  const wrapper = document.createElement('div');
  wrapper.className = 'charto';
  wrapper.style.cssText = 'position:relative;width:100%;min-width:0;isolation:isolate';
  const tooltip = document.createElement('div');
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  tooltip.style.cssText = 'position:absolute;z-index:2;pointer-events:none;padding:10px 13px;border-radius:8px;font:12px/1.55 ui-sans-serif,system-ui,sans-serif;box-shadow:0 6px 20px #0002;white-space:pre-line;max-width:calc(100% - 16px);overflow-wrap:anywhere;box-sizing:border-box';
  const table = document.createElement('table');
  const accessibleData = document.createElement('div');
  accessibleData.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
  accessibleData.append(table);
  wrapper.append(tooltip, accessibleData);
  host.append(wrapper);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function stopAnimations(): void { animations.forEach(animation => animation.cancel()); animations = []; }
  function hideTooltip(): void { tooltip.hidden = true; }

  function render(animate: boolean): void {
    if (destroyed) return;
    stopAnimations();
    hideTooltip();
    const width = Math.max(160, host!.getBoundingClientRect().width || renderedWidth || 640);
    renderedWidth = width;
    const height = options.height!;
    const theme = colors[options.theme ?? 'light'];
    const horizontal = !isLine && options.orientation === 'horizontal';
    const stacked = !isLine && options.mode === 'stacked';
    const count = options.data.length;
    const seriesCount = Math.max(1, options.series?.length ?? 0, ...options.data.map(datum => valuesOf(datum).length));
    const formatTick = options.formatValue ?? ((value: number) => value !== 0 && Math.abs(value) < 0.01 ? value.toExponential(1) : compact.format(value));
    const formatFull = options.formatValue ?? ((value: number) => exact.format(value));
    const domain = getDomain(options.data, stacked);
    const tickWidth = Math.max(...domain.ticks.map(value => formatTick(value).length)) * 6.5;
    const left = horizontal ? (options.labels ? Math.min(112, width * 0.26) : 14) : Math.min(width * 0.3, tickWidth + 16);
    const right = horizontal ? (options.values ? 54 : 24) : 18;
    const top = 24;
    const bottom = horizontal ? 30 : options.labels ? 36 : 18;
    const plotWidth = Math.max(20, width - left - right);
    const plotHeight = height - top - bottom;
    const scale = (value: number): number => horizontal
      ? left + (value - domain.min) / (domain.max - domain.min) * plotWidth
      : top + plotHeight - (value - domain.min) / (domain.max - domain.min) * plotHeight;
    const nextSvg = svgElement('svg', {
      xmlns: NS, width: '100%', height, viewBox: `0 0 ${width} ${height}`,
      role: 'group', 'aria-label': options.label!, 'font-family': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      fill: theme.text,
    });
    nextSvg.style.cssText = 'display:block;overflow:visible;max-width:100%';
    const title = svgElement('title');
    title.textContent = options.label!;
    nextSvg.append(title);
    tooltip.style.background = theme.tooltip;
    tooltip.style.color = theme.tooltipText;
    const marks: SVGGraphicsElement[] = [];
    const attachInteraction = (mark: SVGGraphicsElement, dataIndex: number, seriesIndex: number, name: string, value: number): void => {
      const datum = options.data[dataIndex];
      const label = datum.label;
      const onClick = options.onClick;
      mark.setAttribute('tabindex', marks.length === 0 ? '0' : '-1');
      mark.setAttribute('role', onClick ? 'button' : 'img');
      mark.setAttribute('aria-label', `${label}${name ? ` · ${name}` : ''}: ${formatFull(value)}`);
      mark.style.cursor = onClick ? 'pointer' : 'default';
      const activate = (nativeEvent: MouseEvent | KeyboardEvent): void => {
        if (destroyed || svg !== nextSvg) return;
        onClick?.({ datum, label, value, dataIndex, seriesIndex, seriesName: name || 'Value', nativeEvent });
      };
      if (onClick) mark.addEventListener('click', activate);
      const showTooltip = (event?: PointerEvent): void => {
        tooltip.textContent = `${label}${name ? ` · ${name}` : ''}\n${formatFull(value)}`;
        tooltip.hidden = false;
        const wrapperBounds = wrapper.getBoundingClientRect();
        const markBounds = mark.getBoundingClientRect();
        const mouseX = event ? event.clientX - wrapperBounds.left : markBounds.x + markBounds.width / 2 - wrapperBounds.x;
        const mouseY = event ? event.clientY - wrapperBounds.top : markBounds.y - wrapperBounds.y;
        tooltip.style.left = `${Math.max(8, Math.min(width - tooltip.offsetWidth - 8, mouseX - tooltip.offsetWidth / 2))}px`;
        tooltip.style.top = `${Math.max(0, mouseY - tooltip.offsetHeight - 12)}px`;
      };
      mark.addEventListener('pointerenter', event => { mark.style.filter = 'brightness(1.08)'; showTooltip(event); });
      mark.addEventListener('pointermove', showTooltip);
      mark.addEventListener('pointerleave', () => { mark.style.filter = ''; hideTooltip(); });
      mark.addEventListener('focus', () => showTooltip());
      mark.addEventListener('blur', hideTooltip);
      mark.addEventListener('keydown', event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          if (!event.repeat) activate(event);
          return;
        }
        if (event.key === 'Escape') { hideTooltip(); return; }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = marks.indexOf(mark);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? marks.length - 1 : (current + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + marks.length) % marks.length;
        mark.setAttribute('tabindex', '-1');
        marks[next].setAttribute('tabindex', '0');
        marks[next].focus();
      });
      marks.push(mark);
    };
    if (count === 0) {
      nextSvg.append(svgText('No data yet', width / 2, height / 2, { 'text-anchor': 'middle', 'font-size': 13 }));
    } else {
      for (const value of domain.ticks) {
        const position = scale(value);
        if (options.grid || value === 0) nextSvg.append(svgElement('line', horizontal
          ? { x1: position, x2: position, y1: top, y2: top + plotHeight, stroke: theme.grid, 'stroke-dasharray': value === 0 ? 'none' : '3 5' }
          : { x1: left, x2: width - right, y1: position, y2: position, stroke: theme.grid, 'stroke-dasharray': value === 0 ? 'none' : '3 5' }));
        nextSvg.append(horizontal
          ? svgText(formatTick(value), position, height - 8, { 'text-anchor': 'middle' })
          : svgText(formatTick(value), left - 12, position + 4, { 'text-anchor': 'end' }));
      }
      if (isLine) {
        const spacing = count > 1 ? plotWidth / (count - 1) : 0;
        const pointX = (index: number): number => count === 1 ? left + plotWidth / 2 : left + index * spacing;
        const labelStep = Math.max(1, Math.ceil(44 / Math.max(1, spacing)));
        options.data.forEach((datum, index) => {
          if (options.labels && (index % labelStep === 0 || index === count - 1)) {
            // Reserve the last label's space when intermediate labels are sparse.
            if (index !== count - 1 && index !== 0 && count - 1 - index < labelStep) return;
            nextSvg.append(svgText(shorten(datum.label, Math.max(4, Math.floor(Math.max(44, spacing * labelStep) / 6.5))), pointX(index), height - 12, {
              'text-anchor': count === 1 ? 'middle' : index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle',
            }));
          }
        });
        const pointLayer = svgElement('g');
        for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
          const color = options.series?.[seriesIndex]?.color ?? (seriesIndex === 0 ? options.color : undefined) ?? palette[seriesIndex % palette.length];
          const name = options.series?.[seriesIndex]?.name ?? (seriesCount > 1 ? `Series ${seriesIndex + 1}` : '');
          const runs: Point[][] = [];
          let run: Point[] = [];
          options.data.forEach((datum, index) => {
            const value = valuesOf(datum)[seriesIndex];
            if (value === undefined) {
              if (run.length) runs.push(run);
              run = [];
              return;
            }
            const x = pointX(index);
            const y = scale(value);
            run.push({ x, y });
            const dot = options.points ? svgElement('circle', {
              cx: x, cy: y, r: 3.5, fill: theme.background,
              stroke: datum.color ?? color, 'stroke-width': 2, 'aria-hidden': 'true',
              'data-charto-dot': '',
            }) : undefined;
            const hit = svgElement('circle', { cx: x, cy: y, r: 10, fill: 'transparent', 'data-charto-point': '', 'data-charto-hit': '' });
            hit.style.cssText = 'cursor:default;outline:none';
            attachInteraction(hit, index, seriesIndex, name, value);
            if (dot) {
              const emphasize = (): void => { dot.setAttribute('r', '5'); };
              const restore = (): void => { dot.setAttribute('r', '3.5'); };
              hit.addEventListener('pointerenter', emphasize);
              hit.addEventListener('focus', emphasize);
              hit.addEventListener('pointerleave', restore);
              hit.addEventListener('blur', restore);
              pointLayer.append(dot);
            }
            pointLayer.append(hit);
            if (options.values) pointLayer.append(svgText(formatTick(value), x, y - 11, { 'text-anchor': 'middle', fill: theme.strong, 'font-size': 10 }));
          });
          if (run.length) runs.push(run);
          const d = runs.map(points => linePath(points, options.curve!)).join('');
          if (d) {
            const path = svgElement('path', {
              d, fill: 'none', stroke: color, 'stroke-width': options.strokeWidth!,
              'stroke-linecap': 'round', 'stroke-linejoin': options.curve === 'linear' ? 'miter' : 'round',
              'data-charto-line': '', 'aria-hidden': 'true', pathLength: 1,
            });
            nextSvg.append(path);
            if (animate && options.animate && !motion.matches && typeof path.animate === 'function') {
              animations.push(path.animate([
                { strokeDasharray: '1', strokeDashoffset: '1', opacity: 0.3 },
                { strokeDasharray: '1', strokeDashoffset: '0', opacity: 1 },
              ], { duration: 900, delay: Math.min(seriesIndex * 80, 240), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }));
            }
          }
        }
        nextSvg.append(pointLayer);
        if (animate && options.animate && !motion.matches && typeof pointLayer.animate === 'function') {
          animations.push(pointLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 180, fill: 'backwards' }));
        }
      } else {
        const band = (horizontal ? plotHeight : plotWidth) / count;
        const groupSize = Math.min(band * 0.64, horizontal ? 38 : seriesCount > 1 ? 76 : 56);
        const gap = stacked ? 0 : Math.min(4, groupSize * 0.08);
        const barSize = stacked ? groupSize : Math.max(0.2, (groupSize - gap * (seriesCount - 1)) / seriesCount);
        const labelStep = Math.max(1, Math.ceil((horizontal ? 24 : 44) / band));
        const definitions = svgElement('defs');
        if (stacked) nextSvg.append(definitions);
        options.data.forEach((datum, index) => {
          const center = (horizontal ? top : left) + band * (index + 0.5);
          if (options.labels && index % labelStep === 0) nextSvg.append(horizontal
            ? svgText(shorten(datum.label, Math.floor((left - 14) / 6.5)), left - 14, center + 4, { 'text-anchor': 'end' })
            : svgText(shorten(datum.label, Math.max(4, Math.floor(band * labelStep / 6.5))), center, height - 12, { 'text-anchor': 'middle' }));
          const datumValues = valuesOf(datum);
          const positions = segments(datumValues, stacked);
          const stack = stacked ? svgElement('g', { 'data-charto-stack': '' }) : undefined;
          if (stack) {
            const low = positions.reduce((min, segment) => Math.min(min, segment.end), 0);
            const high = positions.reduce((max, segment) => Math.max(max, segment.end), 0);
            const length = Math.abs(scale(high) - scale(low));
            if (options.radius! > 0 && length > 0) {
              const id = `${chartId}-stack-${index}`;
              const clip = svgElement('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
              clip.append(svgElement('rect', {
                x: horizontal ? scale(low) : center - groupSize / 2,
                y: horizontal ? center - groupSize / 2 : scale(high),
                width: horizontal ? length : barSize,
                height: horizontal ? barSize : length,
                rx: Math.min(options.radius!, barSize / 2, length / 2),
              }));
              definitions.append(clip);
              stack.setAttribute('clip-path', `url(#${id})`);
            }
            stack.style.transformOrigin = horizontal ? `${scale(0)}px ${center}px` : `${center}px ${scale(0)}px`;
            nextSvg.append(stack);
            if (animate && options.animate && !motion.matches && typeof stack.animate === 'function') {
              animations.push(stack.animate([
                { transform: horizontal ? 'scaleX(0)' : 'scaleY(0)', opacity: 0.35 },
                { transform: horizontal ? 'scaleX(1)' : 'scaleY(1)', opacity: 1 },
              ], { duration: 720, delay: Math.min(index * 35, 350), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }));
            }
          }
          datumValues.forEach((value, seriesIndex) => {
            const segment = positions[seriesIndex];
            const start = scale(segment.start);
            const end = scale(segment.end);
            const offset = center - groupSize / 2 + (stacked ? 0 : seriesIndex * (barSize + gap));
            const color = datum.color ?? options.series?.[seriesIndex]?.color ?? (seriesIndex === 0 ? options.color : undefined) ?? palette[seriesIndex % palette.length];
            const x = horizontal ? Math.min(start, end) : offset;
            const y = horizontal ? offset : Math.min(start, end);
            const barWidth = horizontal ? Math.abs(end - start) : barSize;
            const barHeight = horizontal ? barSize : Math.abs(end - start);
            const name = options.series?.[seriesIndex]?.name ?? (seriesCount > 1 ? `Series ${seriesIndex + 1}` : '');
            const description = `${datum.label}${name ? ` · ${name}` : ''}: ${formatFull(value)}`;
            const rect = svgElement('rect', {
              x, y, width: Math.max(0.5, barWidth), height: Math.max(0.5, barHeight),
              rx: stacked ? 0 : Math.min(options.radius!, barWidth / 2, barHeight / 2), fill: color,
              tabindex: marks.length === 0 ? 0 : -1, role: 'img', 'aria-label': description,
              'data-charto-bar': '',
            });
            rect.style.cssText = `cursor:default;outline:none;transform-origin:${horizontal ? scale(0) : x}px ${horizontal ? y : scale(0)}px`;
            attachInteraction(rect, index, seriesIndex, name, value);
            (stack ?? nextSvg).append(rect);
            if (!stacked && animate && options.animate && !motion.matches && typeof rect.animate === 'function') {
              animations.push(rect.animate([
                { transform: horizontal ? 'scaleX(0)' : 'scaleY(0)', opacity: 0.35 },
                { transform: horizontal ? 'scaleX(1)' : 'scaleY(1)', opacity: 1 },
              ], { duration: 720, delay: Math.min(index * 35 + seriesIndex * 25, 350), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }));
            }
            if (options.values && !stacked) nextSvg.append(horizontal
              ? svgText(formatTick(value), end + (value >= 0 ? 8 : -8), y + barHeight / 2 + 4, { 'text-anchor': value >= 0 ? 'start' : 'end', fill: theme.strong, 'font-size': 10 })
              : svgText(formatTick(value), x + barWidth / 2, end + (value >= 0 ? -8 : 15), { 'text-anchor': 'middle', fill: theme.strong, 'font-size': 10 }));
          });
        });
      }
    }
    if (svg) svg.replaceWith(nextSvg); else wrapper.prepend(nextSvg);
    svg = nextSvg;
    table.replaceChildren();
    const caption = table.createCaption();
    caption.textContent = options.label!;
    const header = table.createTHead().insertRow();
    ['Category', ...Array.from({ length: seriesCount }, (_, index) => options.series?.[index]?.name ?? (seriesCount === 1 ? 'Value' : `Series ${index + 1}`))].forEach(name => {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; header.append(th);
    });
    const body = table.createTBody();
    options.data.forEach(datum => {
      const row = body.insertRow();
      const heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = datum.label; row.append(heading);
      const values = valuesOf(datum);
      for (let i = 0; i < seriesCount; i++) row.insertCell().textContent = isLine && values[i] === undefined ? '—' : formatFull(values[i] ?? 0);
    });
  }

  const observer = new ResizeObserver(() => {
    if (Math.abs(host!.getBoundingClientRect().width - renderedWidth) < 1) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => render(false));
  });
  const onMotionChange = (): void => { if (motion.matches) stopAnimations(); };
  motion.addEventListener('change', onMotionChange);
  observer.observe(host);
  render(true);

  return {
    update(patch) {
      if (destroyed) return;
      const next = withDefaults({ ...options, ...patch }, isLine);
      validateChart(next, isLine);
      options = next;
      render(true);
    },
    replay() { render(true); },
    toSVG() {
      if (destroyed) throw new Error('Charto: this chart has been destroyed.');
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', String(renderedWidth));
      clone.setAttribute('role', 'img');
      clone.querySelectorAll('[data-charto-hit]').forEach(node => node.remove());
      clone.querySelectorAll('[data-charto-dot]').forEach(node => node.setAttribute('r', '3.5'));
      clone.querySelectorAll('[data-charto-bar], [data-charto-stack]').forEach(node => {
        node.removeAttribute('tabindex');
        node.removeAttribute('style');
        if (node.getAttribute('role') === 'button') node.setAttribute('role', 'img');
      });
      const background = svgElement('rect', { width: '100%', height: '100%', fill: colors[options.theme ?? 'light'].background });
      clone.prepend(background);
      return new XMLSerializer().serializeToString(clone);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopAnimations();
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener('change', onMotionChange);
      wrapper.remove();
    },
  };
}

/** Create a responsive, accessible SVG bar chart. */
export function barChart(target: string | HTMLElement, options: BarChartOptions): BarChart {
  return createChart(target, options, false);
}

/** Create an SVG line chart with sharp segments or smooth curves. */
export function lineChart(target: string | HTMLElement, options: LineChartOptions): LineChart {
  return createChart(target, options, true);
}
