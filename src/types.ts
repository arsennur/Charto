/** A value, or `null` for one that does not exist yet (not the same as zero). */
export type DatumValue = number | null;

export interface BarDatum {
  label: string;
  /**
   * Use an array for grouped or stacked series. Missing series are zero.
   * `null` is "no value": a bar chart draws a dashed placeholder, a line chart a gap.
   */
  value: DatumValue | DatumValue[];
  color?: string;
}

export interface BarSeries {
  name: string;
  /** Any CSS colour, including `var(--token)`. */
  color?: string;
  /** `'hatched'` draws diagonal stripes with an outline, e.g. for a projection. */
  pattern?: 'solid' | 'hatched';
}

/** Chart chrome colours. Any CSS colour works, including `var(--token)`. */
export interface ChartColors {
  /** Axis and category labels. */
  text: string;
  /** Value labels. */
  strong: string;
  /** Grid lines and the zero line. */
  grid: string;
  /** Line point fill and the exported SVG's background. */
  background: string;
  tooltip: string;
  tooltipText: string;
}

export interface ChartPoint {
  /** The original data item supplied to the chart. */
  datum: BarDatum;
  label: string;
  /** Raw value of the bar, stack segment, or line point; `null` for a missing-value placeholder. */
  value: number | null;
  /** Zero-based index in data. */
  dataIndex: number;
  /** Zero-based index within the datum's value array; 0 for a single value. */
  seriesIndex: number;
  /** Configured name, or "Value" / "Series N" when unnamed. */
  seriesName: string;
}

/** Placeholders are never clickable, so a click always carries a number. */
export interface ChartClickEvent extends Omit<ChartPoint, 'value'> {
  value: number;
  nativeEvent: MouseEvent | KeyboardEvent;
}

export interface BarChartOptions {
  data: BarDatum[];
  series?: BarSeries[];
  color?: string;
  height?: number;
  /** Hide axes, labels, grid, and value labels. Default height is 80px. */
  compact?: boolean;
  /** Exact scale bounds. Data beyond the bounds is clipped. */
  min?: number;
  max?: number;
  /** Enable, disable, or format tooltip text. Strings are never interpreted as HTML. */
  tooltip?: boolean | ((point: ChartPoint) => string);
  orientation?: 'vertical' | 'horizontal';
  mode?: 'grouped' | 'stacked';
  theme?: 'light' | 'dark';
  /** Override the theme's chrome colours, e.g. with your own CSS variables. */
  colors?: Partial<ChartColors>;
  grid?: boolean;
  labels?: boolean;
  /** Value labels at the bar ends; on a stack, its total. */
  values?: boolean;
  /** How a `null` value is drawn: a dashed stub (default) or nothing. */
  missing?: 'placeholder' | 'none';
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
export type LineSeries = Omit<BarSeries, 'pattern'>;

export interface LineChartOptions extends Omit<BarChartOptions, 'orientation' | 'mode' | 'radius' | 'missing' | 'series'> {
  series?: LineSeries[];
  /** Straight segments with sharp joins, or smooth curves through the same points. */
  curve?: 'linear' | 'smooth';
  /** Line thickness in pixels. */
  strokeWidth?: number;
  /** Show point markers. Tooltips and keyboard navigation also work when hidden. */
  points?: boolean;
  /** Subtle gradient from the line to zero (or the nearest scale boundary). */
  fill?: boolean;
}

export interface LineChart extends Chart<LineChartOptions> {}
