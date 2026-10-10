import type { ChartType } from './frame.ts';
import { sankeyGraph, sankeyLayout } from './sankey-layout.ts';
import { NS, exact, hatches, palette, shortNumber, shorten, svgElement, svgText, themeColors, validateChrome } from './svg.ts';
import type { ChartColors, SankeyChartOptions, SankeyItem, SankeyNode } from './types.js';

const BAND = 0.35;
const BAND_HATCHED = 0.75;
const FONT = 'ui-sans-serif, system-ui, -apple-system, sans-serif';

let measurer: CanvasRenderingContext2D | null | undefined;
/** Text's width at 11px in the chart's own font, on a canvas where there is one, else estimated. */
function textWidth(text: string, weight: number): number {
  if (measurer === undefined) measurer = document.createElement('canvas').getContext('2d');
  if (!measurer) return text.length * 6.5;
  measurer.font = `${weight} 11px ${FONT}`;
  return measurer.measureText(text).width;
}

/** A node's label: its name, then its total in the quieter colour. */
function nodeLabel(name: string, total: string, theme: ChartColors): SVGTextElement {
  const text = svgText('', 0, 0, { stroke: theme.background, 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke' });
  const first = svgElement('tspan', { fill: theme.strong, 'font-weight': 500 });
  first.textContent = name;
  text.append(first);
  if (total) {
    const second = svgElement('tspan', { fill: theme.text });
    second.textContent = total;
    text.append(second);
  }
  return text;
}

const estimate = (text: SVGTextElement): number => textWidth(text.childNodes[0].textContent!, 500) + textWidth(text.childNodes[1]?.textContent ?? '', 400);

/** How wide each label is drawn, measured beside the chart so the page's own font counts; estimated where nothing renders. */
function labelWidths(stage: HTMLElement, texts: SVGTextElement[]): number[] {
  const probe = svgElement('svg', { 'font-family': FONT, 'aria-hidden': 'true' });
  probe.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:hidden';
  probe.append(...texts);
  stage.append(probe);
  const widths = texts.map(text => (typeof text.getComputedTextLength === 'function' && text.getComputedTextLength()) || estimate(text));
  probe.remove();
  return widths;
}

/** Shorten a label's name, never its total, until the label fits its room. */
function fit(text: SVGTextElement, drawn: number, room: number): void {
  if (drawn <= room) return;
  const name = text.childNodes[0];
  const label = name.textContent!;
  const total = textWidth(text.childNodes[1]?.textContent ?? '', 400);
  const ratio = drawn / Math.max(1, estimate(text));
  let length = label.length;
  while (length > 3 && (textWidth(shorten(label, length), 500) + total) * ratio > room) length--;
  name.textContent = shorten(label, length);
}

function defaults(input: SankeyChartOptions): SankeyChartOptions {
  return {
    ...input,
    height: input.height ?? 320,
    nodeWidth: input.nodeWidth ?? 10,
    nodeGap: input.nodeGap ?? 12,
    labels: input.labels ?? true,
    values: input.values ?? true,
    theme: input.theme ?? 'light',
    animate: input.animate ?? true,
    tooltip: input.tooltip ?? true,
    label: input.label ?? 'Sankey chart',
  };
}

function validate(options: SankeyChartOptions): void {
  sankeyGraph(options.nodes, options.links);
  if (options.height !== undefined && (!Number.isFinite(options.height) || options.height < 120)) throw new RangeError('Charto: height must be at least 120.');
  if (options.minWidth !== undefined && (!Number.isFinite(options.minWidth) || options.minWidth < 0)) throw new RangeError('Charto: minWidth must be a number of at least 0.');
  if (options.nodeWidth !== undefined && (!Number.isFinite(options.nodeWidth) || options.nodeWidth <= 0)) throw new RangeError('Charto: nodeWidth must be greater than 0.');
  if (options.nodeGap !== undefined && (!Number.isFinite(options.nodeGap) || options.nodeGap < 0)) throw new RangeError('Charto: nodeGap must be a number of at least 0.');
  validateChrome(options);
}

export const sankey: ChartType<SankeyChartOptions> = {
  validate,
  defaults,
  scroll: true,
  clean(clone) {
    clone.querySelectorAll('[data-charto-node], [data-charto-band]').forEach(node => {
      node.removeAttribute('tabindex');
      node.removeAttribute('style');
      if (node.getAttribute('role') === 'button') node.setAttribute('role', 'img');
    });
  },
  draw(context) {
    const { options, chartId, table, stage } = context;
    const { nodes, links } = options;
    const theme = themeColors(options);
    const height = options.height!;
    // Never narrower than minWidth: a narrower host scrolls the chart sideways.
    const width = Math.max(160, options.minWidth ?? 0, context.hostWidth);
    const scrolls = width > context.hostWidth + 0.5;
    stage.style.overflowX = scrolls ? 'auto' : '';
    const formatShort = options.formatValue ?? shortNumber;
    const formatFull = options.formatValue ?? ((value: number) => exact.format(value));
    const svg = svgElement('svg', {
      xmlns: NS, width: scrolls ? width : '100%', height, viewBox: `0 0 ${width} ${height}`,
      role: 'group', 'aria-label': options.label!, 'font-family': FONT,
      fill: theme.text,
    });
    svg.style.cssText += `;display:block;overflow:visible${scrolls ? '' : ';max-width:100%'}`;
    const title = svgElement('title');
    title.textContent = options.label!;
    const definitions = svgElement('defs');
    svg.append(title, definitions);

    // Every label sits right of its node. The last column's sit outside the plot, in
    // room kept for the widest of them, so none covers a band or is shortened.
    const graph = sankeyGraph(nodes, links);
    const last = graph.columns - 1;
    const texts = options.labels && links.some(link => link.value > 0)
      ? nodes.map((node, index) => nodeLabel(node.label, options.values ? ` ${formatShort(graph.value[index])}` : '', theme))
      : [];
    const widths = texts.length ? labelWidths(stage, texts) : [];
    const reserve = texts.length ? Math.min(width * 0.4, 12 + Math.max(0, ...widths.filter((_, index) => graph.column[index] === last))) : 0;
    const layout = sankeyLayout(nodes, links, { width, height, nodeWidth: options.nodeWidth!, nodeGap: options.nodeGap!, top: 8, right: 1 + reserve, bottom: 8, left: 1 });
    if (!layout.links.some(Boolean)) {
      svg.append(svgText('No data yet', width / 2, height / 2, { 'text-anchor': 'middle', 'font-size': 13 }));
    } else {
      const nodeColor = (index: number): string => nodes[index].color ?? palette[index % palette.length];
      const hatch = hatches(definitions, chartId);
      // A tail fades out over its length, or in for a tail entering a node: one
      // mask per direction, drawn in each tail's own bounding box.
      const fades = new Set<string>();
      const fade = (direction: 'in' | 'out'): string => {
        const id = `${chartId}-fade-${direction}`;
        if (!fades.has(id)) {
          const gradient = svgElement('linearGradient', { id: `${id}-gradient` });
          gradient.append(
            svgElement('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': direction === 'out' ? 1 : 0 }),
            svgElement('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': direction === 'out' ? 0 : 1 }),
          );
          const mask = svgElement('mask', { id, maskContentUnits: 'objectBoundingBox' });
          mask.append(svgElement('rect', { width: 1, height: 1, fill: `url(#${id}-gradient)` }));
          definitions.append(gradient, mask);
          fades.add(id);
        }
        return `url(#${id})`;
      };
      type Mark = { element: SVGGraphicsElement; emphasize(on: boolean): void };
      const marks: Record<'node' | 'link', Mark[]> = { node: [], link: [] };
      const bandLayer = svgElement('g', { 'data-charto-bands': '' });
      const nodeLayer = svgElement('g', { 'data-charto-nodes': '' });
      layout.links.forEach((link, index) => {
        if (!link) return;
        const color = links[index].color ?? nodeColor((link.source ?? link.target)!);
        const hatched = links[index].pattern === 'hatched';
        const strength = hatched ? BAND_HATCHED : BAND;
        const tail = link.source === null ? 'in' : link.target === null ? 'out' : undefined;
        const band = svgElement('path', {
          d: link.path, fill: hatched ? hatch(color) : color, 'fill-opacity': strength,
          ...(tail ? { mask: fade(tail) } : {}),
          'data-charto-band': '',
        });
        band.style.outline = 'none';
        bandLayer.append(band);
        marks.link[index] = { element: band, emphasize: on => band.style.setProperty('fill-opacity', on ? String(Math.min(1, strength + 0.3)) : '') };
      });
      layout.nodes.forEach(node => {
        const rect = svgElement('rect', {
          x: node.x, y: node.y, width: node.width, height: Math.max(1, node.height),
          rx: Math.min(2, node.width / 2), fill: nodeColor(node.index), 'data-charto-node': '',
        });
        rect.style.outline = 'none';
        nodeLayer.append(rect);
        // A node lights up the bands that touch it.
        marks.node[node.index] = {
          element: rect,
          emphasize: on => {
            rect.style.filter = on ? 'brightness(1.08)' : '';
            for (const index of [...node.incoming, ...node.outgoing]) marks.link[index].emphasize(on);
          },
        };
      });

      const attach = (kind: 'node' | 'link', index: number): void => {
        let item: SankeyItem;
        let name: string;
        if (kind === 'node') {
          const node = layout.nodes[index];
          item = { kind, node: nodes[index], index, value: node.value, inflow: node.inflow, outflow: node.outflow };
          name = nodes[index].label;
        } else {
          const link = layout.links[index]!;
          const end = (at: number | null): SankeyNode | null => at === null ? null : nodes[at];
          item = { kind, link: links[index], index, value: link.value, source: end(link.source), target: end(link.target) };
          name = `${item.source?.label ?? '…'} → ${item.target?.label ?? '…'}`;
        }
        const value = formatFull(item.value);
        const { onClick } = options;
        context.mark(marks[kind][index].element, {
          label: `${name}: ${value}`,
          tooltip: () => options.tooltip === false ? '' : typeof options.tooltip === 'function' ? options.tooltip(item) : `${name}\n${value}`,
          activate: onClick && (nativeEvent => onClick({ ...item, nativeEvent })),
          emphasize: marks[kind][index].emphasize,
        });
      };
      // Keyboard order follows the flow: column by column, each node top to bottom
      // with the tails entering it before it and the bands leaving it after it.
      const order = [...layout.nodes].sort((a, b) => a.column - b.column || a.y - b.y || a.index - b.index);
      for (const node of order) {
        for (const index of node.incoming) if (layout.links[index]!.source === null) attach('link', index);
        attach('node', node.index);
        for (const index of node.outgoing) attach('link', index);
      }

      const labelLayer = svgElement('g', { 'data-charto-labels': '', 'pointer-events': 'none', 'aria-hidden': 'true' });
      const step = layout.columns > 1 ? layout.columnX[1] - layout.columnX[0] : 0;
      for (const node of texts.length ? layout.nodes : []) {
        const text = texts[node.index];
        const outside = node.column === last;
        // A label stops short of the next column; the last column's start past its tails.
        fit(text, widths[node.index], outside ? reserve - 12 : step - node.width - 12);
        text.setAttribute('x', String(node.x + node.width + 6 + (outside ? layout.tailRoom.right : 0)));
        text.setAttribute('y', String(node.y + Math.max(1, node.height) / 2 + 4));
        labelLayer.append(text);
      }
      svg.append(bandLayer, nodeLayer, labelLayer);
      // Bands are drawn in from the left; nodes and labels fade in.
      context.play(bandLayer, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, delay: 120, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
      context.play(nodeLayer, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'backwards' });
      context.play(labelLayer, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 200, fill: 'backwards' });
    }

    table.replaceChildren();
    table.createCaption().textContent = options.label!;
    const header = table.createTHead().insertRow();
    for (const name of ['From', 'To', 'Value']) {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; header.append(th);
    }
    const body = table.createTBody();
    const labelOf = new Map(nodes.map(node => [node.id, node.label]));
    for (const link of links) {
      const row = body.insertRow();
      const heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = labelOf.get(link.from!) ?? '—'; row.append(heading);
      row.insertCell().textContent = labelOf.get(link.to!) ?? '—';
      row.insertCell().textContent = formatFull(link.value);
    }
    return { svg, width, view: Math.min(width, context.hostWidth), track: context.hostWidth };
  },
};
