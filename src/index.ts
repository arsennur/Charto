import { getDomain, segments, validate, valuesOf } from './layout.ts';
import { createFrame, type ChartType } from './frame.ts';
import { linePath, type Point } from './line-path.ts';
import { sankey } from './sankey.ts';
import { NS, exact, hatches, palette, shortNumber, shorten, svgElement, svgText, themeColors, validateChrome } from './svg.ts';
import type { BarChart, BarChartOptions, LineChart, LineChartOptions, SankeyChart, SankeyChartOptions } from './types.js';
export type { BarChart, BarChartOptions, BarDatum, BarSeries, ChartClickEvent, ChartColors, ChartPoint, DatumValue, LineChart, LineChartOptions, LineDatum, LineSeries, SankeyChart, SankeyChartOptions, SankeyClickEvent, SankeyItem, SankeyLink, SankeyNode } from './types.js';

type Options = BarChartOptions & LineChartOptions;

function withDefaults(input: Options, isLine: boolean): Options {
  return {
    ...input,
    height: input.height ?? (input.compact ? 80 : 320),
    compact: input.compact ?? false,
    tooltip: input.tooltip ?? true,
    orientation: input.orientation ?? 'vertical',
    mode: input.mode ?? 'grouped',
    theme: input.theme ?? 'light',
    grid: input.grid ?? true,
    labels: input.labels ?? true,
    values: input.values ?? false,
    missing: input.missing ?? 'placeholder',
    animate: input.animate ?? true,
    radius: input.radius ?? 5,
    label: input.label ?? (isLine ? 'Line chart' : 'Bar chart'),
    curve: input.curve ?? 'smooth',
    strokeWidth: input.strokeWidth ?? 3,
    points: input.points ?? true,
    fill: input.fill ?? false,
  };
}

function validateChart(options: Options, isLine: boolean): void {
  validate(options);
  validateChrome(options);
  if (isLine && options.curve !== undefined && !['linear', 'smooth'].includes(options.curve)) {
    throw new TypeError("Charto: curve must be 'linear' or 'smooth'.");
  }
  if (isLine && options.strokeWidth !== undefined && (!Number.isFinite(options.strokeWidth) || options.strokeWidth <= 0 || options.strokeWidth > 20)) {
    throw new RangeError('Charto: strokeWidth must be greater than 0 and at most 20.');
  }
}

/** Bars and lines: one category axis, one value scale. */
function cartesian(isLine: boolean): ChartType<Options> {
  return {
    validate: options => validateChart(options, isLine),
    defaults: input => withDefaults(input, isLine),
    clean(clone) {
      clone.querySelectorAll('[data-charto-hit]').forEach(node => node.remove());
      clone.querySelectorAll('[data-charto-dot]').forEach(node => node.setAttribute('r', '3.5'));
      clone.querySelectorAll('[data-charto-bar], [data-charto-stack], [data-charto-missing]').forEach(node => {
        node.removeAttribute('tabindex');
        node.removeAttribute('style');
        if (node.getAttribute('role') === 'button') node.setAttribute('role', 'img');
      });
    },
    draw(context) {
      const { options, chartId, table } = context;
      const mini = options.compact!;
      const width = Math.max(mini ? 32 : 160, context.hostWidth);
      const height = options.height!;
      const theme = themeColors(options);
      const horizontal = !isLine && options.orientation === 'horizontal';
      const stacked = !isLine && options.mode === 'stacked';
      const count = options.data.length;
      const seriesCount = Math.max(1, options.series?.length ?? 0, ...options.data.map(datum => valuesOf(datum).length));
      const formatTick = options.formatValue ?? shortNumber;
      const formatFull = options.formatValue ?? ((value: number) => exact.format(value));
      const domain = getDomain(options.data, stacked, options);
      const tickWidth = Math.max(...domain.ticks.map(value => formatTick(value).length)) * 6.5;
      const inset = isLine ? 10 : 4;
      const left = mini ? inset : horizontal ? (options.labels ? Math.min(112, width * 0.26) : 14) : Math.min(width * 0.3, tickWidth + 16);
      const right = mini ? inset : horizontal ? (options.values ? 54 : 24) : 18;
      const top = mini ? inset : 24;
      const bottom = mini ? inset : horizontal ? 30 : options.labels ? 36 : 18;
      const plotWidth = Math.max(1, width - left - right);
      const plotHeight = height - top - bottom;
      const clamp = (value: number): number => Math.max(domain.min, Math.min(domain.max, value));
      const scale = (value: number): number => {
        // Bound offscreen coordinates even when a tiny fixed range excludes large values.
        const fraction = Math.max(-1e6, Math.min(1e6, (value - domain.min) / (domain.max - domain.min)));
        return horizontal ? left + fraction * plotWidth : top + plotHeight - fraction * plotHeight;
      };
      const baseline = scale(clamp(0));
      const nextSvg = svgElement('svg', {
        xmlns: NS, width: '100%', height, viewBox: `0 0 ${width} ${height}`,
        role: 'group', 'aria-label': options.label!, 'font-family': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        fill: theme.text,
      });
      nextSvg.style.cssText += ';display:block;overflow:visible;max-width:100%';
      const title = svgElement('title');
      title.textContent = options.label!;
      nextSvg.append(title);
      const definitions = svgElement('defs');
      nextSvg.append(definitions);
      const attachInteraction = (mark: SVGGraphicsElement, dataIndex: number, seriesIndex: number, name: string, value: number | null): void => {
        const datum = options.data[dataIndex];
        const label = datum.label;
        // A missing-value placeholder says "nothing here yet": it has a tooltip and a
        // place in the keyboard order, but nothing to open.
        const onClick = value === null ? undefined : options.onClick;
        const point = { datum, label, value, dataIndex, seriesIndex, seriesName: name || 'Value' };
        const shown = value === null ? 'No value' : formatFull(value);
        context.mark(mark, {
          label: `${label}${name ? ` · ${name}` : ''}: ${shown}`,
          tooltip: () => options.tooltip === false ? ''
            : typeof options.tooltip === 'function' ? options.tooltip(point) : `${label}${name ? ` · ${name}` : ''}\n${shown}`,
          activate: onClick && (nativeEvent => onClick({ ...point, value: value as number, nativeEvent })),
        });
      };
      if (count === 0) {
        if (!mini) nextSvg.append(svgText('No data yet', width / 2, height / 2, { 'text-anchor': 'middle', 'font-size': 13 }));
      } else {
        for (const value of mini ? [] : domain.ticks) {
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
            if (!mini && options.labels && (index % labelStep === 0 || index === count - 1)) {
              // Reserve the last label's space when intermediate labels are sparse.
              if (index !== count - 1 && index !== 0 && count - 1 - index < labelStep) return;
              nextSvg.append(svgText(shorten(datum.label, Math.max(4, Math.floor(Math.max(44, spacing * labelStep) / 6.5))), pointX(index), height - 12, {
                'text-anchor': count === 1 ? 'middle' : index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle',
              }));
            }
          });
          const fillLayer = svgElement('g', { 'data-charto-fills': '' });
          const lineLayer = svgElement('g');
          if (options.min !== undefined || options.max !== undefined) {
            const clipId = `${chartId}-plot`;
            const clip = svgElement('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
            clip.append(svgElement('rect', { x: left, y: top, width: plotWidth, height: plotHeight }));
            definitions.append(clip);
            fillLayer.setAttribute('clip-path', `url(#${clipId})`);
            lineLayer.setAttribute('clip-path', `url(#${clipId})`);
          }
          if (options.fill) nextSvg.append(fillLayer);
          nextSvg.append(lineLayer);
          const pointLayer = svgElement('g');
          for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
            const color = options.series?.[seriesIndex]?.color ?? (seriesIndex === 0 ? options.color : undefined) ?? palette[seriesIndex % palette.length];
            const name = options.series?.[seriesIndex]?.name ?? (seriesCount > 1 ? `Series ${seriesIndex + 1}` : '');
            const runs: Point[][] = [];
            let run: Point[] = [];
            options.data.forEach((datum, index) => {
              const value = valuesOf(datum)[seriesIndex];
              if (value === undefined || value === null) {
                if (run.length) runs.push(run);
                run = [];
                return;
              }
              const x = pointX(index);
              const y = scale(value);
              run.push({ x, y });
              if (value < domain.min || value > domain.max) return;
              const dot = options.points ? svgElement('circle', {
                cx: x, cy: y, r: 3.5, fill: theme.background,
                stroke: datum.color ?? color, 'stroke-width': 2, 'aria-hidden': 'true',
                'data-charto-dot': '',
              }) : undefined;
              const hit = svgElement('circle', { cx: x, cy: y, r: 10, fill: 'transparent', 'data-charto-point': '', 'data-charto-hit': '' });
              hit.style.cssText += ';cursor:default;outline:none';
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
              if (!mini && options.values) pointLayer.append(svgText(formatTick(value), x, y - 11, { 'text-anchor': 'middle', fill: theme.strong, 'font-size': 10 }));
            });
            if (run.length) runs.push(run);
            if (options.fill && runs.some(points => points.length > 1)) {
              const gradientId = `${chartId}-fill-${seriesIndex}`;
              const gradient = svgElement('linearGradient', { id: gradientId, gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: top, y2: top + plotHeight });
              gradient.append(svgElement('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.26 }), svgElement('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0.02 }));
              definitions.append(gradient);
              const area = svgElement('path', {
                d: runs.filter(points => points.length > 1).map(points => `${linePath(points, options.curve!)}L${points.at(-1)!.x},${baseline}L${points[0].x},${baseline}Z`).join(''),
                fill: `url(#${gradientId})`, 'data-charto-area': '', 'aria-hidden': 'true', 'pointer-events': 'none',
              });
              fillLayer.append(area);
            }
            const d = runs.map(points => linePath(points, options.curve!)).join('');
            if (d) {
              const path = svgElement('path', {
                d, fill: 'none', stroke: color, 'stroke-width': options.strokeWidth!,
                'stroke-linecap': 'round', 'stroke-linejoin': options.curve === 'linear' ? 'miter' : 'round',
                'data-charto-line': '', 'aria-hidden': 'true', pathLength: 1,
              });
              lineLayer.append(path);
              context.play(path, [
                { strokeDasharray: '1', strokeDashoffset: '1', opacity: 0.3 },
                { strokeDasharray: '1', strokeDashoffset: '0', opacity: 1 },
              ], { duration: 900, delay: Math.min(seriesIndex * 80, 240), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
            }
          }
          nextSvg.append(pointLayer);
          if (options.fill) context.play(fillLayer, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: 'backwards' });
          context.play(pointLayer, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 180, fill: 'backwards' });
        } else {
          const band = (horizontal ? plotHeight : plotWidth) / count;
          const groupSize = Math.min(band * 0.64, horizontal ? 38 : seriesCount > 1 ? 76 : 56);
          const gap = stacked ? 0 : Math.min(4, groupSize * 0.08);
          const barSize = stacked ? groupSize : Math.max(0.2, (groupSize - gap * (seriesCount - 1)) / seriesCount);
          const labelStep = Math.max(1, Math.ceil((horizontal ? 24 : 44) / band));
          const seriesColor = (datum: { color?: string }, seriesIndex: number): string => datum.color ?? options.series?.[seriesIndex]?.color ?? (seriesIndex === 0 ? options.color : undefined) ?? palette[seriesIndex % palette.length];
          const seriesName = (seriesIndex: number): string => options.series?.[seriesIndex]?.name ?? (seriesCount > 1 ? `Series ${seriesIndex + 1}` : '');
          const hatch = hatches(definitions, chartId);
          // A missing value is a short dashed stub off the baseline, toward the side
          // the scale has room on: never an empty slot that reads as zero.
          const placeholder = (dataIndex: number, seriesIndex: number, offset: number, size: number): void => {
            const stub = Math.min(12, (horizontal ? plotWidth : plotHeight) / 4);
            const end = horizontal ? left + plotWidth : top;
            const forward = horizontal ? baseline + stub <= end : baseline - stub >= end;
            const from = horizontal ? (forward ? baseline : baseline - stub) : (forward ? baseline - stub : baseline);
            const rect = svgElement('rect', {
              x: (horizontal ? from : offset) + 0.5, y: (horizontal ? offset : from) + 0.5,
              width: Math.max(0.5, (horizontal ? stub : size) - 1), height: Math.max(0.5, (horizontal ? size : stub) - 1),
              rx: Math.min(options.radius!, size / 2, stub / 2), fill: 'transparent',
              stroke: seriesColor(options.data[dataIndex], seriesIndex), 'stroke-width': 1, 'stroke-dasharray': '3 3',
              'data-charto-missing': '',
            });
            rect.style.cssText += ';outline:none';
            attachInteraction(rect, dataIndex, seriesIndex, seriesName(seriesIndex), null);
            nextSvg.append(rect);
          };
          options.data.forEach((datum, index) => {
            const center = (horizontal ? top : left) + band * (index + 0.5);
            if (!mini && options.labels && index % labelStep === 0) nextSvg.append(horizontal
              ? svgText(shorten(datum.label, Math.floor((left - 14) / 6.5)), left - 14, center + 4, { 'text-anchor': 'end' })
              : svgText(shorten(datum.label, Math.max(4, Math.floor(band * labelStep / 6.5))), center, height - 12, { 'text-anchor': 'middle' }));
            const datumValues = valuesOf(datum);
            const positions = segments(datumValues, stacked);
            const stack = stacked ? svgElement('g', { 'data-charto-stack': '' }) : undefined;
            if (stack) {
              const low = clamp(positions.reduce((min, segment) => Math.min(min, segment.end), 0));
              const high = clamp(positions.reduce((max, segment) => Math.max(max, segment.end), 0));
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
              stack.style.transformOrigin = horizontal ? `${baseline}px ${center}px` : `${center}px ${baseline}px`;
              nextSvg.append(stack);
              context.play(stack, [
                { transform: horizontal ? 'scaleX(0)' : 'scaleY(0)', opacity: 0.35 },
                { transform: horizontal ? 'scaleX(1)' : 'scaleY(1)', opacity: 1 },
              ], { duration: 720, delay: Math.min(index * 35, 350), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
            }
            const present = datumValues.filter((value): value is number => value !== null);
            if (stacked && present.length === 0 && datumValues.length > 0 && options.missing === 'placeholder') {
              placeholder(index, 0, center - groupSize / 2, barSize);
            }
            datumValues.forEach((value, seriesIndex) => {
              if (value === null) {
                if (!stacked && options.missing === 'placeholder') placeholder(index, seriesIndex, center - groupSize / 2 + seriesIndex * (barSize + gap), barSize);
                return;
              }
              const segment = positions[seriesIndex];
              if (Math.max(segment.start, segment.end) < domain.min || Math.min(segment.start, segment.end) > domain.max) return;
              const start = scale(clamp(segment.start));
              const end = scale(clamp(segment.end));
              if (start === end && value !== 0) return;
              const offset = center - groupSize / 2 + (stacked ? 0 : seriesIndex * (barSize + gap));
              const color = seriesColor(datum, seriesIndex);
              const x = horizontal ? Math.min(start, end) : offset;
              const y = horizontal ? offset : Math.min(start, end);
              const barWidth = horizontal ? Math.abs(end - start) : barSize;
              const barHeight = horizontal ? barSize : Math.abs(end - start);
              const name = seriesName(seriesIndex);
              const description = `${datum.label}${name ? ` · ${name}` : ''}: ${formatFull(value)}`;
              const hatched = options.series?.[seriesIndex]?.pattern === 'hatched';
              // A hatched bar is stripes inside a 1px outline; the outline sits inside the
              // bar's own bounds, so neighbours and the stack's clip keep their geometry.
              const inset = hatched && barWidth > 1 && barHeight > 1 ? 0.5 : 0;
              const rect = svgElement('rect', {
                x: x + inset, y: y + inset, width: Math.max(0.5, barWidth - inset * 2), height: Math.max(0.5, barHeight - inset * 2),
                rx: stacked ? 0 : Math.min(options.radius!, barWidth / 2, barHeight / 2), fill: hatched ? hatch(color) : color,
                ...(hatched ? { stroke: color, 'stroke-width': 1 } : {}),
                tabindex: -1, role: 'img', 'aria-label': description,
                'data-charto-bar': '',
              });
              rect.style.cssText += `;cursor:default;outline:none;transform-origin:${horizontal ? baseline : x}px ${horizontal ? y : baseline}px`;
              attachInteraction(rect, index, seriesIndex, name, value);
              (stack ?? nextSvg).append(rect);
              if (!stacked) context.play(rect, [
                { transform: horizontal ? 'scaleX(0)' : 'scaleY(0)', opacity: 0.35 },
                { transform: horizontal ? 'scaleX(1)' : 'scaleY(1)', opacity: 1 },
              ], { duration: 720, delay: Math.min(index * 35 + seriesIndex * 25, 350), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
              if (!mini && options.values && !stacked) nextSvg.append(horizontal
                ? svgText(formatTick(value), end + (value >= 0 ? 8 : -8), y + barHeight / 2 + 4, { 'text-anchor': value >= 0 ? 'start' : 'end', fill: theme.strong, 'font-size': 10 })
                : svgText(formatTick(value), x + barWidth / 2, end + (value >= 0 ? -8 : 15), { 'text-anchor': 'middle', fill: theme.strong, 'font-size': 10 }));
            });
            // A stack's value label is its total, at the end of each side it reaches.
            if (!mini && options.values && stacked && present.length > 0) {
              const up = present.filter(value => value > 0).reduce((sum, value) => sum + value, 0);
              const down = present.filter(value => value < 0).reduce((sum, value) => sum + value, 0);
              for (const total of up === 0 && down === 0 ? [0] : [up, down].filter(value => value !== 0)) {
                if (total < domain.min || total > domain.max) continue;
                const end = scale(total);
                nextSvg.append(horizontal
                  ? svgText(formatTick(total), end + (total >= 0 ? 8 : -8), center + 4, { 'text-anchor': total >= 0 ? 'start' : 'end', fill: theme.strong, 'font-size': 10, 'data-charto-total': '' })
                  : svgText(formatTick(total), center, end + (total >= 0 ? -8 : 15), { 'text-anchor': 'middle', fill: theme.strong, 'font-size': 10, 'data-charto-total': '' }));
              }
            }
          });
        }
      }
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
        for (let i = 0; i < seriesCount; i++) {
          const value = values[i];
          row.insertCell().textContent = value === null || (isLine && value === undefined) ? '—' : formatFull(value ?? 0);
        }
      });
      return { svg: nextSvg, width };
    },
  };
}

/** Create a responsive, accessible SVG bar chart. */
export function barChart(target: string | HTMLElement, options: BarChartOptions): BarChart {
  return createFrame(target, options, cartesian(false));
}

/** Create an SVG line chart with sharp segments or smooth curves. */
export function lineChart(target: string | HTMLElement, options: LineChartOptions): LineChart {
  return createFrame(target, options, cartesian(true));
}

/** Create a Sankey chart: nodes in columns, bands as wide as the flow between them. */
export function sankeyChart(target: string | HTMLElement, options: SankeyChartOptions): SankeyChart {
  return createFrame(target, options, sankey);
}
