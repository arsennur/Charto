import { barChart, lineChart, sankeyChart, type BarDatum, type BarChartOptions, type ChartClickEvent, type ChartPoint, type LineChartOptions, type SankeyChart, type SankeyChartOptions, type SankeyClickEvent, type SankeyItem, type SankeyLink, type SankeyNode } from '@arsennur/charto';

const data: BarDatum[] = [{ label: 'Mon', value: [10, 20] }];
const tooltip = (point: ChartPoint): string => `${point.label}: ${point.value ?? '—'}`;
const options: BarChartOptions = { data, theme: 'dark', mode: 'stacked', radius: 8, compact: true, height: 60, min: 0, max: 100, tooltip };
const chart = barChart(document.createElement('div'), options);
const onClick = (event: ChartClickEvent): void => {
  const datum: BarDatum = event.datum;
  const value: number = event.value;
  const indexes: number[] = [event.dataIndex, event.seriesIndex];
  const names: string[] = [event.label, event.seriesName];
  const nativeEvent: MouseEvent | KeyboardEvent = event.nativeEvent;
  void [datum, value, indexes, names, nativeEvent];
};
chart.update({ color: '#27bd83', onClick });
chart.update({ onClick: undefined });
const svg: string = chart.toSVG();
chart.destroy();
void svg;

const lineOptions: LineChartOptions = { data, curve: 'smooth', strokeWidth: 2, points: false, fill: true, compact: true, tooltip: false, onClick };
const line = lineChart(document.createElement('div'), lineOptions);
line.update({ curve: 'linear', points: true });
line.update({ min: undefined, max: 100, tooltip });
line.toSVG();
line.destroy();
// @ts-expect-error Invalid interpolation must be rejected by the public types.
lineChart('#chart', { data, curve: 'bezier' });
// @ts-expect-error Click callbacks receive typed data, not a plain number.
barChart('#chart', { data, onClick: (value: number) => console.log(value) });
// @ts-expect-error Tooltip formatters must return text.
lineChart('#chart', { data, tooltip: () => document.createElement('div') });
// @ts-expect-error Gradient fill belongs to line charts.
barChart('#chart', { data, fill: true });

const missingData: BarDatum[] = [{ label: 'A', value: null }, { label: 'B', value: [1, null] }];
const styled: BarChartOptions = { data: missingData, missing: 'none', values: true, colors: { text: 'var(--muted)', grid: '#eee' }, series: [{ name: 'Projected', pattern: 'hatched' }] };
barChart('#chart', styled);
lineChart('#chart', { data: missingData, colors: { background: 'var(--card)' } });
// @ts-expect-error Placeholders belong to bar charts.
lineChart('#chart', { data, missing: 'none' });
// @ts-expect-error Patterns belong to bar series.
lineChart('#chart', { data, series: [{ name: 'A', pattern: 'hatched' }] });
// @ts-expect-error A click always carries a number, never a placeholder's null.
barChart('#chart', { data, onClick: (event: ChartClickEvent & { value: null }) => event });

const flowNodes: SankeyNode[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', column: 1, color: 'var(--ok)' }];
const flowLinks: SankeyLink[] = [{ from: 'a', to: 'b', value: 3 }, { from: 'a', value: 1, pattern: 'hatched' }, { to: 'b', value: 2, color: '#999' }];
const flowTooltip = (item: SankeyItem): string => item.kind === 'node'
  ? `${item.node.label} ${item.inflow}/${item.outflow}`
  : `${item.source?.label ?? '…'} → ${item.target?.label ?? '…'} ${item.link.value}`;
const flowOptions: SankeyChartOptions = {
  nodes: flowNodes, links: flowLinks, height: 240, minWidth: 600, nodeWidth: 8, nodeGap: 10, labels: true, values: false,
  theme: 'dark', colors: { text: 'var(--muted)' }, animate: false, label: 'Flow', formatValue: value => `${value}`, tooltip: flowTooltip,
};
const flow: SankeyChart = sankeyChart(document.createElement('div'), flowOptions);
const onFlowClick = (event: SankeyClickEvent): void => {
  const index: number = event.index;
  const value: number = event.value;
  const nativeEvent: MouseEvent | KeyboardEvent = event.nativeEvent;
  const ends: Array<SankeyNode | null> = event.kind === 'link' ? [event.source, event.target] : [event.node];
  void [index, value, nativeEvent, ends];
};
flow.update({ onClick: onFlowClick, tooltip: false });
flow.update({ links: [], tooltip: undefined });
const flowSvg: string = flow.toSVG();
flow.destroy();
void flowSvg;
// @ts-expect-error A link always carries its value.
sankeyChart('#chart', { nodes: flowNodes, links: [{ from: 'a', to: 'b' }] });
// @ts-expect-error A band is solid or hatched.
sankeyChart('#chart', { nodes: flowNodes, links: [{ from: 'a', to: 'b', value: 1, pattern: 'dots' }] });
// @ts-expect-error A Sankey takes nodes and links, not data.
sankeyChart('#chart', { data: [] });
// @ts-expect-error A node item carries no link.
const notALink = (item: SankeyItem): unknown => item.kind === 'node' ? item.link : null;
void notALink;
