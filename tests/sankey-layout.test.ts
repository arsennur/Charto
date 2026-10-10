import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ribbonPath, sankeyGraph, sankeyLayout, type SankeyBox, type SankeyLayout } from '../src/sankey-layout.ts';
import type { SankeyLink, SankeyNode } from '../src/types.ts';

const box: SankeyBox = { width: 900, height: 400, nodeWidth: 10, nodeGap: 12, top: 8, right: 1, bottom: 8, left: 1 };
const plotBottom = box.height - box.bottom;
const close = (actual: number, expected: number, message?: string): void => assert.ok(Math.abs(actual - expected) < 1e-6, message ?? `${actual} ≠ ${expected}`);
const nodes = (...ids: string[]): SankeyNode[] => ids.map(id => ({ id, label: id }));

// A sales funnel: every step drops leads into Lost or Early exit in the last
// column, Intake skips straight to Waiting for Quote, some leads are still on
// their way (tails out) and some enter at Need Photos (a tail in).
const funnelNodes: SankeyNode[] = [
  { id: 'intake', label: 'Intake', column: 0 },
  { id: 'photos', label: 'Need Photos', column: 1 },
  { id: 'quote', label: 'Waiting for Quote', column: 2 },
  { id: 'sent', label: 'Quote Sent', column: 3 },
  { id: 'interested', label: 'Interested', column: 4 },
  { id: 'follow', label: 'Follow Up', column: 4 },
  { id: 'booked', label: 'Booked', column: 5 },
  { id: 'lost', label: 'Lost', column: 5 },
  { id: 'exit', label: 'Early exit', column: 5 },
];
const funnelLinks: SankeyLink[] = [
  { from: 'intake', to: 'photos', value: 240 },
  { from: 'intake', to: 'quote', value: 315 },
  { from: 'intake', to: 'exit', value: 870 },
  { from: 'intake', value: 60, pattern: 'hatched' },
  { to: 'photos', value: 300 },
  { from: 'photos', to: 'quote', value: 380 },
  { from: 'photos', to: 'exit', value: 90 },
  { from: 'photos', to: 'lost', value: 40 },
  { from: 'photos', value: 30, pattern: 'hatched' },
  { from: 'quote', to: 'sent', value: 640 },
  { from: 'quote', to: 'lost', value: 55 },
  { from: 'sent', to: 'interested', value: 210 },
  { from: 'sent', to: 'follow', value: 160 },
  { from: 'sent', to: 'lost', value: 240 },
  { from: 'sent', to: 'booked', value: 12 },
  { from: 'interested', to: 'booked', value: 60 },
  { from: 'interested', to: 'lost', value: 120 },
  { from: 'follow', to: 'booked', value: 25 },
  { from: 'follow', to: 'lost', value: 110 },
  { from: 'follow', value: 25, pattern: 'hatched' },
];
const funnel = (): SankeyLayout => sankeyLayout(funnelNodes, funnelLinks, box);
const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 - 1e-9 && b0 < a1 - 1e-9;

test('a node without a column goes one past the furthest node linking into it', () => {
  const graph = sankeyGraph(nodes('a', 'b', 'c', 'd', 'e'), [
    { from: 'a', to: 'b', value: 1 }, { from: 'b', to: 'c', value: 1 }, { from: 'a', to: 'd', value: 1 }, { from: 'c', to: 'd', value: 1 },
  ]);
  assert.deepEqual(graph.column, [0, 1, 2, 3, 0]);
  assert.equal(graph.columns, 4);
  const fixed = sankeyGraph([{ id: 'a', label: 'A', column: 2 }, { id: 'b', label: 'B' }, { id: 'c', label: 'C', column: 5 }], [
    { from: 'a', to: 'b', value: 1 }, { from: 'b', to: 'c', value: 1 }, { to: 'a', value: 3 },
  ]);
  assert.deepEqual(fixed.column, [2, 3, 5], 'explicit columns are kept and a tail in does not move its node');
});

test('a node is as tall as the larger of its inflow and outflow, tails included', () => {
  const graph = sankeyGraph(nodes('a', 'b', 'c'), [
    { from: 'a', to: 'b', value: 30 }, { to: 'b', value: 20 }, { from: 'b', to: 'c', value: 10 }, { from: 'b', value: 15 },
  ]);
  assert.deepEqual([graph.inflow[1], graph.outflow[1], graph.value[1]], [50, 25, 50]);
  const layout = funnel();
  for (const node of layout.nodes) {
    close(node.height, Math.max(node.inflow, node.outflow) * layout.scale);
    for (const side of [node.outgoing, node.incoming]) {
      let y = node.y;
      for (const index of side) {
        const link = layout.links[index]!;
        close(side === node.outgoing ? link.stops[0].y : link.stops.at(-1)!.y, y, 'slots are not stacked edge to edge');
        y += link.thickness;
      }
      assert.ok(y <= node.y + node.height + 1e-6, 'bands overflow their node');
    }
    const flow = (list: number[]): number => list.reduce((sum, index) => sum + layout.links[index]!.value, 0);
    close(flow(node.outgoing), node.outflow);
    close(flow(node.incoming), node.inflow);
  }
});

test('nodes keep their given order within a column', () => {
  const layout = funnel();
  const [interested, follow] = [layout.nodes[4], layout.nodes[5]];
  assert.ok(interested.y < follow.y);
  close(follow.y, interested.y + interested.height + layout.gap);
  const [booked, lost, exit] = [layout.nodes[6], layout.nodes[7], layout.nodes[8]];
  assert.ok(booked.y < lost.y && lost.y < exit.y);
  close(booked.y, box.top);
});

test('one scale for the chart, set by its fullest column', () => {
  const layout = funnel();
  const totals = Array.from({ length: layout.columns }, (_, column) => {
    const own = layout.nodes.filter(node => node.column === column);
    const passages = layout.links.filter(link => link?.passes.includes(column));
    const gaps = Math.max(0, own.length - 1) + (own.length && passages.length ? 1 : 0);
    const value = own.reduce((sum, node) => sum + node.value, 0) + passages.reduce((sum, link) => sum + link!.value, 0);
    return (box.height - box.top - box.bottom - gaps * layout.gap) / value;
  });
  close(layout.scale, Math.min(...totals));
  const fullest = totals.indexOf(Math.min(...totals));
  const bottoms = [
    ...layout.nodes.filter(node => node.column === fullest).map(node => node.y + node.height),
    ...layout.links.flatMap(link => link?.stops.filter((_, at) => link.passes[at - 1] === fullest).map(stop => stop.y + link.thickness) ?? []),
  ];
  close(Math.max(...bottoms), plotBottom, 'the fullest column does not fill the height');
  // Doubling every value changes the scale, not the picture.
  const doubled = sankeyLayout(funnelNodes, funnelLinks.map(link => ({ ...link, value: link.value * 2 })), box);
  close(doubled.scale * 2, layout.scale);
  doubled.nodes.forEach((node, index) => close(node.y, layout.nodes[index].y));
});

test('a link that skips columns passes below every node of the columns it crosses', () => {
  const layout = funnel();
  let crossings = 0;
  for (const link of layout.links) {
    if (!link) continue;
    assert.equal(link.stops.length, link.source !== null && link.target !== null ? link.passes.length + 2 : 1);
    link.passes.forEach((column, at) => {
      crossings++;
      const stop = link.stops[at + 1];
      close(stop.x0, layout.columnX[column]);
      for (const node of layout.nodes.filter(node => node.column === column)) {
        assert.ok(!overlaps(stop.y, stop.y + link.thickness, node.y, node.y + node.height), `band ${link.index} crosses node ${node.index}`);
        assert.ok(stop.y >= node.y + node.height + layout.gap - 1e-6, `passage ${link.index} is not below node ${node.index}`);
      }
    });
  }
  assert.equal(crossings, 1 + 4 + 3 + 3 + 2 + 1 + 1, 'every skipped column has a passage');
  // Between columns a band is a curve in the gap, so passages are the only place it meets a column.
  for (const link of layout.links) {
    link?.stops.forEach((stop, at) => {
      if (at === 0) return;
      assert.ok(link.stops[at - 1].x1 <= stop.x0, 'stops are not left to right');
    });
  }
});

test('drop-offs into the last column gather into one stream along the foot of the chart', () => {
  const layout = funnel();
  for (let column = 1; column < layout.columns - 1; column++) {
    const passages = layout.links.filter(link => link?.passes.includes(column)).map(link => ({ link: link!, stop: link!.stops[link!.passes.indexOf(column) + 1] }))
      .sort((a, b) => a.stop.y - b.stop.y);
    if (!passages.length) continue;
    close(passages.at(-1)!.stop.y + passages.at(-1)!.link.thickness, plotBottom, `column ${column}'s stream is not at the foot`);
    passages.slice(1).forEach((passage, at) => close(passage.stop.y, passages[at].stop.y + passages[at].link.thickness, `column ${column}'s stream has a gap`));
    // Bands that leave the stream sooner ride on top: no band leaves through another.
    const targets = passages.map(({ link }) => layout.nodes[link.target!]);
    targets.slice(1).forEach((target, at) => assert.ok(target.column > targets[at].column || (target.column === targets[at].column && target.y >= targets[at].y), `column ${column}'s stream is out of order`));
  }
  // Into Lost, the stream arrives in its own order, below the bands of the column before.
  const lost = layout.nodes[7];
  const sources = lost.incoming.map(index => layout.links[index]!.source!);
  assert.deepEqual(sources.map(index => funnelNodes[index].id), ['interested', 'follow', 'sent', 'quote', 'photos']);
});

test('at a node, bands leave in the order of where they go and arrive in the order of where they come from', () => {
  const layout = funnel();
  const id = (index: number): string => {
    const link = funnelLinks[index];
    return `${link.from ?? '…'}>${link.to ?? '…'}`;
  };
  assert.deepEqual(layout.nodes[0].outgoing.map(id), ['intake>photos', 'intake>quote', 'intake>exit', 'intake>…'], 'Intake: next column first, then by passage, tail last');
  assert.deepEqual(layout.nodes[1].incoming.map(id), ['intake>photos', '…>photos'], 'a tail in comes after the links');
  assert.deepEqual(layout.nodes[3].outgoing.map(id), ['sent>interested', 'sent>follow', 'sent>booked', 'sent>lost']);
  assert.deepEqual(layout.nodes[2].incoming.map(id), ['photos>quote', 'intake>quote'], 'a band from a passage arrives below one from a node');
});

test('tails are short, fade from their node, and get room at the edges', () => {
  const layout = funnel();
  const gap = layout.columnX[1] - layout.columnX[0] - box.nodeWidth;
  close(layout.tail, Math.min(28, gap * 0.4));
  const out = layout.links[3]!;
  assert.equal(out.target, null);
  assert.deepEqual(out.stops.length, 1);
  close(out.stops[0].x0, layout.nodes[0].x + box.nodeWidth);
  close(out.stops[0].x1 - out.stops[0].x0, layout.tail);
  const entering = layout.links[4]!;
  close(entering.stops[0].x1, layout.nodes[1].x);
  close(entering.stops[0].x1 - entering.stops[0].x0, layout.tail);
  close(layout.columnX[0], box.left, 'no tail enters the first column, so it needs no room');
  const edge = sankeyLayout(nodes('a', 'b'), [{ to: 'a', value: 5 }, { from: 'a', to: 'b', value: 5 }, { from: 'b', value: 2 }], box);
  assert.ok(edge.columnX[0] - box.left >= edge.tail, 'a tail into the first column has no room');
  assert.ok(box.width - box.right - (edge.columnX[1] + box.nodeWidth) >= edge.tail, 'a tail out of the last column has no room');
});

test('a zero link is allowed and not drawn', () => {
  const layout = sankeyLayout(nodes('a', 'b', 'c'), [{ from: 'a', to: 'b', value: 4 }, { from: 'a', to: 'c', value: 0 }, { from: 'b', to: 'c', value: 0 }], box);
  assert.equal(layout.links[1], null);
  assert.equal(layout.links[2], null);
  assert.deepEqual(layout.nodes[0].outgoing, [0]);
  assert.equal(layout.nodes[2].value, 0);
  assert.equal(layout.columns, 3, 'a zero link still places its target');
  const empty = sankeyLayout(nodes('a', 'b'), [{ from: 'a', to: 'b', value: 0 }], box);
  assert.equal(empty.scale, 0);
  assert.ok(empty.links.every(link => link === null));
  assert.equal(sankeyLayout([], [], box).columns, 0);
});

test('a link must go to a later column: a Sankey draws no cycles', () => {
  assert.throws(() => sankeyGraph(nodes('a', 'b'), [{ from: 'a', to: 'b', value: 1 }, { from: 'b', to: 'a', value: 1 }]), RangeError);
  assert.throws(() => sankeyGraph(nodes('a'), [{ from: 'a', to: 'a', value: 1 }]), /later column|cycle/);
  assert.throws(() => sankeyGraph([{ id: 'a', label: 'A', column: 1 }, { id: 'b', label: 'B', column: 1 }], [{ from: 'a', to: 'b', value: 1 }]), /"a" to "b" must go to a later column/);
  assert.throws(() => sankeyGraph([{ id: 'a', label: 'A', column: 2 }, { id: 'b', label: 'B', column: 0 }], [{ from: 'a', to: 'b', value: 1 }]), RangeError);
  assert.throws(() => sankeyGraph(nodes('a', 'b', 'c'), [{ from: 'a', to: 'b', value: 1 }, { from: 'b', to: 'c', value: 1 }, { from: 'c', to: 'a', value: 1 }]), RangeError);
});

test('invalid nodes and links fail early with useful messages', () => {
  const two = nodes('a', 'b');
  assert.throws(() => sankeyGraph(two, [{ from: 'a', to: 'zz', value: 1 }]), { name: 'TypeError', message: /unknown node "zz"/ });
  assert.throws(() => sankeyGraph(nodes('a', 'a'), []), { name: 'TypeError', message: /"a" is used twice/ });
  assert.throws(() => sankeyGraph(two, [{ value: 1 }]), { name: 'TypeError', message: /from, a to/ });
  for (const value of [NaN, Infinity, '3' as unknown as number, undefined as unknown as number]) {
    assert.throws(() => sankeyGraph(two, [{ from: 'a', to: 'b', value }]), { name: 'TypeError', message: /finite/ });
  }
  for (const value of [-1, 1e101]) assert.throws(() => sankeyGraph(two, [{ from: 'a', to: 'b', value }]), RangeError);
  for (const column of [-1, 1.5, 1001]) assert.throws(() => sankeyGraph([{ id: 'a', label: 'A', column }], []), RangeError);
  assert.throws(() => sankeyGraph([{ id: 'a' } as SankeyNode], []), TypeError);
  assert.throws(() => sankeyGraph(two, [{ from: 'a', to: 'b', value: 1, pattern: 'dots' as 'hatched' }]), /pattern/);
  assert.throws(() => sankeyGraph(two, [{ from: 'a', to: 'b', value: 1, color: 3 as unknown as string }]), /colour/);
  assert.throws(() => sankeyGraph({} as SankeyNode[], []), /arrays/);
  assert.doesNotThrow(() => sankeyGraph(two, [{ from: 'a', value: 0 }, { to: 'b', value: 2 }]));
});

test('a ribbon keeps its thickness: level through a stop, curved between stops', () => {
  assert.equal(ribbonPath([{ x0: 10, x1: 10, y: 0 }, { x0: 50, x1: 50, y: 20 }], 5), 'M10,0C30,0 30,20 50,20L50,25C30,25 30,5 10,5Z');
  assert.equal(ribbonPath([{ x0: 10, x1: 30, y: 4 }], 6), 'M10,4L30,4L30,10L10,10Z');
  const through = ribbonPath([{ x0: 0, x1: 0, y: 0 }, { x0: 40, x1: 50, y: 30 }, { x0: 90, x1: 90, y: 30 }], 2);
  assert.ok(through.includes('L50,30') && through.includes('L40,32'), 'a passage is not crossed level');
  assert.equal(ribbonPath([], 3), '');
});

test('a crowded column shrinks the gaps so it still fits', () => {
  const many = Array.from({ length: 40 }, (_, index) => ({ id: `n${index}`, label: `N${index}`, column: 1 }));
  const layout = sankeyLayout([{ id: 'root', label: 'Root' }, ...many], many.map(node => ({ from: 'root', to: node.id, value: 1 })), { ...box, height: 200 });
  assert.ok(layout.gap < box.nodeGap && layout.scale > 0);
  const last = layout.nodes.at(-1)!;
  assert.ok(last.y + last.height <= 200 - box.bottom + 1e-6, 'the crowded column overflows');
});
