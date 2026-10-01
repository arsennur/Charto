import { barChart, lineChart, type BarDatum, type BarChartOptions, type ChartClickEvent, type ChartPoint, type LineChartOptions } from 'charto';

const data: BarDatum[] = [{ label: 'Mon', value: [10, 20] }];
const tooltip = (point: ChartPoint): string => `${point.label}: ${point.value}`;
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
