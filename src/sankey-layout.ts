import type { SankeyLink, SankeyNode } from './types.js';

/** The drawing area: the SVG's size, the node bars and the outer padding. */
export interface SankeyBox {
  width: number;
  height: number;
  nodeWidth: number;
  nodeGap: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where a band's top edge runs across one column: a point at a node's edge (x0 = x1), a span through a passage or a tail. */
export interface BandStop { x0: number; x1: number; y: number }

export interface SankeyNodeLayout {
  index: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The larger of inflow and outflow, tails included. */
  value: number;
  inflow: number;
  outflow: number;
  /** Link indices entering, top to bottom along the left edge; tails in come last. */
  incoming: number[];
  /** Link indices leaving, top to bottom along the right edge; tails out come last. */
  outgoing: number[];
}

export interface SankeyLinkLayout {
  index: number;
  source: number | null;
  target: number | null;
  value: number;
  /** Band thickness in pixels. */
  thickness: number;
  /** Columns the band crosses under their nodes, left to right. */
  passes: number[];
  /** Left to right: the source edge, every passage, the target edge. A tail is one stop. */
  stops: BandStop[];
  /** The ribbon's outline. */
  path: string;
}

export interface SankeyLayout {
  columns: number;
  /** Pixels per unit of value, one for the whole chart. */
  scale: number;
  /** The gap used between stacked items: nodeGap, or less when a column would not fit. */
  gap: number;
  /** How far a tail reaches from its node. */
  tail: number;
  /** Room kept at each edge for the tails that enter the first column or leave the last. */
  tailRoom: { left: number; right: number };
  /** Left edge of each column's nodes. */
  columnX: number[];
  nodes: SankeyNodeLayout[];
  /** By index in `links`; null for a zero link, which is not drawn. */
  links: (SankeyLinkLayout | null)[];
}

export interface SankeyGraph {
  /** Per node. */
  column: number[];
  inflow: number[];
  outflow: number[];
  value: number[];
  /** Per link; null for a tail's missing end. */
  source: (number | null)[];
  target: (number | null)[];
  /** Number of columns. */
  columns: number;
}

const MAX_COLUMN = 1000;
const TAIL = 28;

/** Resolve ids, infer columns and add up the flows. Throws on anything a Sankey cannot draw. */
export function sankeyGraph(nodes: SankeyNode[], links: SankeyLink[]): SankeyGraph {
  if (!Array.isArray(nodes) || !Array.isArray(links)) throw new TypeError('Charto: nodes and links must be arrays.');
  const byId = new Map<string, number>();
  nodes.forEach((node, index) => {
    if (!node || typeof node.id !== 'string' || typeof node.label !== 'string') throw new TypeError('Charto: each node needs a string id and label.');
    if (byId.has(node.id)) throw new TypeError(`Charto: node id "${node.id}" is used twice.`);
    if (node.column !== undefined && (!Number.isInteger(node.column) || node.column < 0 || node.column > MAX_COLUMN)) {
      throw new RangeError(`Charto: a node column must be a whole number from 0 to ${MAX_COLUMN}.`);
    }
    if (node.color !== undefined && typeof node.color !== 'string') throw new TypeError('Charto: a node colour must be a CSS colour string.');
    byId.set(node.id, index);
  });
  const resolve = (id: unknown): number | null => {
    if (id === undefined) return null;
    const index = typeof id === 'string' ? byId.get(id) : undefined;
    if (index === undefined) throw new TypeError(`Charto: a link names an unknown node "${String(id)}".`);
    return index;
  };
  const source: (number | null)[] = [];
  const target: (number | null)[] = [];
  for (const link of links) {
    if (!link || typeof link !== 'object') throw new TypeError('Charto: each link must be an object.');
    if (link.from === undefined && link.to === undefined) throw new TypeError('Charto: a link needs a from, a to, or both.');
    if (typeof link.value !== 'number' || !Number.isFinite(link.value)) throw new TypeError('Charto: link values must be finite numbers.');
    if (link.value < 0 || link.value > 1e100) throw new RangeError('Charto: link values must be between 0 and 1e100.');
    if (link.color !== undefined && typeof link.color !== 'string') throw new TypeError('Charto: a link colour must be a CSS colour string.');
    if (link.pattern !== undefined && link.pattern !== 'solid' && link.pattern !== 'hatched') throw new TypeError("Charto: link pattern must be 'solid' or 'hatched'.");
    source.push(resolve(link.from));
    target.push(resolve(link.to));
  }
  // A node without a column goes one past the furthest node linking into it.
  const feeders: number[][] = nodes.map(() => []);
  links.forEach((_, index) => {
    const from = source[index];
    const to = target[index];
    if (from !== null && to !== null) feeders[to].push(from);
  });
  const column: number[] = [];
  const state = nodes.map(() => 0); // 0 unplaced, 1 being placed, 2 placed
  const place = (index: number): number => {
    const fixed = nodes[index].column;
    if (fixed !== undefined) return fixed;
    if (state[index] === 2) return column[index];
    if (state[index] === 1) throw new RangeError('Charto: these links form a cycle; a Sankey draws none.');
    state[index] = 1;
    let at = 0;
    for (const from of feeders[index]) at = Math.max(at, place(from) + 1);
    state[index] = 2;
    return (column[index] = at);
  };
  nodes.forEach((_, index) => { column[index] = place(index); });
  links.forEach((_, index) => {
    const from = source[index];
    const to = target[index];
    if (from !== null && to !== null && column[to] <= column[from]) {
      throw new RangeError(`Charto: the link from "${nodes[from].id}" to "${nodes[to].id}" must go to a later column; a Sankey draws no cycles.`);
    }
  });
  const inflow = nodes.map(() => 0);
  const outflow = nodes.map(() => 0);
  links.forEach((link, index) => {
    const from = source[index];
    const to = target[index];
    if (from !== null) outflow[from] += link.value;
    if (to !== null) inflow[to] += link.value;
  });
  return {
    column, inflow, outflow, source, target,
    value: nodes.map((_, index) => Math.max(inflow[index], outflow[index])),
    columns: nodes.length ? Math.max(...column) + 1 : 0,
  };
}

const coordinate = (value: number): string => String(Number(value.toFixed(2)));

/** A ribbon of constant thickness through its stops: level across each stop, a cubic Bézier between them. */
export function ribbonPath(stops: BandStop[], thickness: number): string {
  if (!stops.length) return '';
  const at = (x: number, y: number): string => `${coordinate(x)},${coordinate(y)}`;
  const curve = (from: BandStop, to: BandStop, fromY: number, toY: number, forward: boolean): string => {
    const middle = (from.x1 + to.x0) / 2;
    return forward
      ? `C${at(middle, fromY)} ${at(middle, toY)} ${at(to.x0, toY)}`
      : `C${at(middle, toY)} ${at(middle, fromY)} ${at(from.x1, fromY)}`;
  };
  let d = `M${at(stops[0].x0, stops[0].y)}`;
  stops.forEach((stop, index) => {
    if (index > 0) d += curve(stops[index - 1], stop, stops[index - 1].y, stop.y, true);
    if (stop.x1 > stop.x0) d += `L${at(stop.x1, stop.y)}`;
  });
  for (let index = stops.length - 1; index >= 0; index--) {
    const stop = stops[index];
    if (index === stops.length - 1) d += `L${at(stop.x1, stop.y + thickness)}`;
    if (stop.x1 > stop.x0) d += `L${at(stop.x0, stop.y + thickness)}`;
    if (index > 0) d += curve(stops[index - 1], stop, stops[index - 1].y + thickness, stop.y + thickness, false);
  }
  return `${d}Z`;
}

/**
 * Place every node and band. Pure: no DOM.
 *
 * Nodes stack from the top of their column in the order given. A link that skips
 * columns runs under the nodes of every column it crosses, in a passage. A passage
 * bound for the last column stacks up from the foot of the chart, so those flows (a
 * funnel's drop-offs) gather into one stream along the bottom; any other passage
 * hangs right under the column's nodes, so a skip to a middle column never dives to
 * the foot and climbs back. One scale
 * serves the whole chart, set by the fullest column.
 */
export function sankeyLayout(nodes: SankeyNode[], links: SankeyLink[], box: SankeyBox): SankeyLayout {
  const graph = sankeyGraph(nodes, links);
  const { column, source, target, columns } = graph;
  const drawn = (index: number): boolean => links[index].value > 0;
  const plotTop = box.top;
  const plotHeight = Math.max(1, box.height - box.top - box.bottom);
  const plotBottom = plotTop + plotHeight;

  // Columns spread evenly across the width; a tail at either edge gets room to fade.
  const tailInAtEdge = links.some((_, index) => drawn(index) && source[index] === null && column[target[index]!] === 0);
  const tailOutAtEdge = links.some((_, index) => drawn(index) && target[index] === null && column[source[index]!] === columns - 1);
  const tailRoom = { left: tailInAtEdge ? TAIL : 0, right: tailOutAtEdge ? TAIL : 0 };
  const left = box.left + tailRoom.left;
  const span = Math.max(1, box.width - box.right - tailRoom.right - left);
  const nodeWidth = Math.min(box.nodeWidth, span);
  const step = columns > 1 ? (span - nodeWidth) / (columns - 1) : 0;
  const columnX = Array.from({ length: columns }, (_, index) => columns > 1 ? left + index * step : left + (span - nodeWidth) / 2);
  const tail = Math.max(0, Math.min(TAIL, columns > 1 ? (step - nodeWidth) * 0.4 : TAIL));

  const members: number[][] = Array.from({ length: columns }, () => []);
  nodes.forEach((_, index) => members[column[index]].push(index));
  const passes: number[][] = links.map((_, index) => {
    const from = source[index];
    const to = target[index];
    if (!drawn(index) || from === null || to === null) return [];
    return Array.from({ length: column[to] - column[from] - 1 }, (_, step) => column[from] + 1 + step);
  });
  const passing: number[][] = Array.from({ length: columns }, () => []);
  passes.forEach((crossed, index) => crossed.forEach(at => passing[at].push(index)));

  // One scale for the chart: the fullest column, gaps included, fills the height.
  const gapsIn = (at: number): number => Math.max(0, members[at].length - 1) + (members[at].length && passing[at].length ? 1 : 0);
  const mostGaps = Math.max(0, ...members.map((_, at) => gapsIn(at)));
  const gap = mostGaps ? Math.min(box.nodeGap, plotHeight * 0.5 / mostGaps) : box.nodeGap;
  let scale = Infinity;
  members.forEach((list, at) => {
    const total = list.reduce((sum, index) => sum + graph.value[index], 0) + passing[at].reduce((sum, index) => sum + links[index].value, 0);
    if (total > 0) scale = Math.min(scale, (plotHeight - gapsIn(at) * gap) / total);
  });
  if (!Number.isFinite(scale)) scale = 0;

  const laid: SankeyNodeLayout[] = nodes.map((_, index) => ({
    index, column: column[index], x: columnX[column[index]], y: 0, width: nodeWidth, height: graph.value[index] * scale,
    value: graph.value[index], inflow: graph.inflow[index], outflow: graph.outflow[index], incoming: [], outgoing: [],
  }));
  for (const list of members) {
    let y = plotTop;
    for (const index of list) { laid[index].y = y; y += laid[index].height + gap; }
  }

  // Passages, left to right, so a band's place in the previous column is known.
  // A passage bound for the last column joins the stream at the foot; any other
  // hangs one gap under the column's nodes. The scale fits nodes, gaps and every
  // passage into the height, so the two stacks can touch but never overlap. In
  // each stack a band that leaves sooner rides on top, so it rises without crossing
  // the ones that carry on; then by its target's height, then by where it comes from.
  const passageY: number[][] = links.map(() => []);
  const previousY = (index: number, at: number): number => {
    const from = source[index]!;
    return column[from] === at - 1 ? laid[from].y : passageY[index][at - 1];
  };
  const toLast = (index: number): boolean => column[target[index]!] === columns - 1;
  passing.forEach((list, at) => {
    const order = (a: number, b: number): number => column[target[a]!] - column[target[b]!] || laid[target[a]!].y - laid[target[b]!].y
      || previousY(a, at) - previousY(b, at) || a - b;
    const under = list.filter(index => !toLast(index)).sort(order);
    const foot = list.filter(toLast).sort(order);
    const lowest = members[at].at(-1);
    let y = lowest === undefined ? plotTop : laid[lowest].y + laid[lowest].height + gap;
    for (const index of under) { passageY[index][at] = y; y += links[index].value * scale; }
    y = plotBottom - foot.reduce((sum, index) => sum + links[index].value * scale, 0);
    for (const index of foot) { passageY[index][at] = y; y += links[index].value * scale; }
  });

  // Slots along each node's edges: ordered by where the band goes next (or came
  // from), a passage counting where it sits; tails after the links.
  const startY: number[] = [];
  const endY: number[] = [];
  const nextY = (index: number): number => {
    const from = source[index]!;
    const to = target[index];
    if (to === null) return Infinity;
    return column[to] === column[from] + 1 ? laid[to].y : passageY[index][column[from] + 1];
  };
  const lastY = (index: number): number => {
    const to = target[index]!;
    const from = source[index];
    if (from === null) return Infinity;
    return column[from] === column[to] - 1 ? laid[from].y : passageY[index][column[to] - 1];
  };
  for (const node of laid) {
    node.outgoing = links.map((_, index) => index).filter(index => drawn(index) && source[index] === node.index)
      .sort((a, b) => nextY(a) - nextY(b) || a - b);
    node.incoming = links.map((_, index) => index).filter(index => drawn(index) && target[index] === node.index)
      .sort((a, b) => lastY(a) - lastY(b) || a - b);
    let y = node.y;
    for (const index of node.outgoing) { startY[index] = y; y += links[index].value * scale; }
    y = node.y;
    for (const index of node.incoming) { endY[index] = y; y += links[index].value * scale; }
  }

  const laidLinks = links.map((link, index): SankeyLinkLayout | null => {
    if (!drawn(index)) return null;
    const from = source[index];
    const to = target[index];
    const thickness = link.value * scale;
    let stops: BandStop[];
    if (from === null) {
      const x = laid[to!].x;
      stops = [{ x0: x - tail, x1: x, y: endY[index] }];
    } else if (to === null) {
      const x = laid[from].x + nodeWidth;
      stops = [{ x0: x, x1: x + tail, y: startY[index] }];
    } else {
      const start = laid[from].x + nodeWidth;
      stops = [
        { x0: start, x1: start, y: startY[index] },
        ...passes[index].map(at => ({ x0: columnX[at], x1: columnX[at] + nodeWidth, y: passageY[index][at] })),
        { x0: laid[to].x, x1: laid[to].x, y: endY[index] },
      ];
    }
    return { index, source: from, target: to, value: link.value, thickness, passes: passes[index], stops, path: ribbonPath(stops, thickness) };
  });

  return { columns, scale, gap, tail, tailRoom, columnX, nodes: laid, links: laidLinks };
}
