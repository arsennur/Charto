export interface BarDatum {
  label: string;
  /** Use an array for grouped or stacked series. Missing series are zero. */
  value: number | number[];
  color?: string;
}

export interface BarSeries {
  name: string;
  color?: string;
}

export interface ChartClickEvent {
  /** The original data item supplied to the chart. */
  datum: BarDatum;
  label: string;
  /** Raw value of the clicked bar, stack segment, or line point. */
  value: number;
  /** Zero-based index in data. */
  dataIndex: number;
  /** Zero-based index within the datum's value array; 0 for a single value. */
  seriesIndex: number;
  /** Configured name, or "Value" / "Series N" when unnamed. */
  seriesName: string;
  nativeEvent: MouseEvent | KeyboardEvent;
}

export interface BarChartOptions {
  data: BarDatum[];
  series?: BarSeries[];
  color?: string;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  mode?: 'grouped' | 'stacked';
  theme?: 'light' | 'dark';
  grid?: boolean;
  labels?: boolean;
  values?: boolean;
  animate?: boolean;
  /** Corner radius in pixels. Stacks round only the outside corners. */
  radius?: number;
  /** Accessible name for the chart and its data table. */
  label?: string;
  formatValue?: (value: number) => string;
  /** Called on click/tap or Enter/Space activation of a bar or line point. */
  onClick?: (event: ChartClickEvent) => void;
}

export interface Chart<Options> {
  update(options: Partial<Options>): void;
  replay(): void;
  /** Self-contained SVG, ready to save or embed. */
  toSVG(): string;
  destroy(): void;
}

export interface BarChart extends Chart<BarChartOptions> {}

export type LineDatum = BarDatum;
export type LineSeries = BarSeries;

export interface LineChartOptions extends Omit<BarChartOptions, 'orientation' | 'mode' | 'radius'> {
  /** Straight segments with sharp joins, or smooth curves through the same points. */
  curve?: 'linear' | 'smooth';
  /** Line thickness in pixels. */
  strokeWidth?: number;
  /** Show point markers. Tooltips and keyboard navigation also work when hidden. */
  points?: boolean;
}

export interface LineChart extends Chart<LineChartOptions> {}
