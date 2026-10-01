import { barChart, lineChart, type BarChart, type BarChartOptions, type BarDatum, type ChartClickEvent, type ChartPoint, type LineChart, type LineChartOptions } from '../src/index.ts';
import bundleSize from './bundle-size.json';
import './style.css';

const icons = {
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  right: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  replay: '<path d="M3 10a9 9 0 1 1 2.5 8.2M3 4v6h6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  line: '<path d="m3 17 6-9 5 5 7-10"/>',
  curved: '<path d="M3 17C6 17 6 7 9 7s3 8 6 8 3-12 6-12"/>',
  bars: '<path d="M5 20V11m7 9V4m7 16V8" stroke-width="3"/>',
  horizontal: '<path d="M4 5h9M4 12h16M4 19h12" stroke-width="3"/>',
  grouped: '<path d="M4 20V8m5 12V12m6 8V4m5 16V9" stroke-width="2.5"/>',
  stacked: '<path d="M6 20v-7m0-4V5m6 15V9m0-4V3m6 17v-5m0-4V7" stroke-width="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14.4A8.5 8.5 0 0 1 9.6 4a8.5 8.5 0 1 0 10.4 10.4Z"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  shuffle: '<path d="m17 3 4 4-4 4M3 17l5-5m5-5h8M3 7l5 5 5 5h8m-4-4 4 4-4 4"/>',
};
function icon(name: keyof typeof icons, size = 16): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
const logo = '<span class="logo-mark" aria-hidden="true"><i></i><i></i><i></i></span>';
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a href="#" class="brand" aria-label="Charto home">${logo}<span>charto<span class="brand-dot">.</span></span><span class="version">v0.2</span></a>
    <nav aria-label="Main navigation"><a class="nav-active" href="#playground">Playground</a><a href="#examples">Examples</a><a href="#quick-start">Quick start ${icon('arrow', 13)}</a></nav>
    <span class="header-note"><span class="status-dot"></span> Less, but better.</span>
  </header>

  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div><div class="eyebrow"><span class="small-line"></span> A LITTLE LIBRARY WITH GOOD TASTE</div><h1 id="hero-title">Small library.<br><span>Beautiful charts.</span><span class="hero-asterisk" aria-hidden="true">✳</span></h1></div>
      <div class="hero-aside"><p>Your data deserves a little design. <br>Thoughtful defaults, gentle motion, and <br class="desktop-br"> nothing weighing you down.</p><div class="hero-facts"><span><b>0</b> dependencies</span><span><b>SVG</b> all the way</span><span><b id="bundle-size">Tiny</b><span id="bundle-suffix"> by design</span></span></div></div>
    </section>

    <section id="playground" class="playground" aria-label="Chart playground">
      <div class="section-heading"><div class="section-title"><span class="section-index">01 /</span><h2>The playground</h2><span class="section-subtitle">A little room to experiment.</span></div><div class="playground-header-actions"><div class="family-switch" role="group" aria-label="Chart type"><button data-family="bar" aria-pressed="false">${icon('bars', 14)} Bar</button><button class="selected" data-family="line" aria-pressed="true">${icon('line', 14)} Line</button></div><span class="live-indicator"><span class="status-dot"></span> LIVE PREVIEW</span></div></div>
      <div class="workbench">
        <div class="canvas-column">
          <div class="canvas-toolbar"><div class="chart-tabs" id="bar-tabs" role="group" aria-label="Bar chart type" hidden>
            <button class="chart-tab active" data-kind="vertical" aria-pressed="true">${icon('bars')}<span>Vertical</span></button>
            <button class="chart-tab" data-kind="horizontal" aria-pressed="false">${icon('horizontal')}<span>Horizontal</span></button>
            <button class="chart-tab" data-kind="grouped" aria-pressed="false">${icon('grouped')}<span>Grouped</span></button>
            <button class="chart-tab" data-kind="stacked" aria-pressed="false">${icon('stacked')}<span>Stacked</span></button>
          </div><div class="chart-tabs" id="line-tabs" role="group" aria-label="Line style"><button class="chart-tab" data-curve="linear" aria-pressed="false">${icon('line')}<span>Sharp</span></button><button class="chart-tab active" data-curve="smooth" aria-pressed="true">${icon('curved')}<span>Curved</span></button><span class="line-style-note" id="line-style-note">Smooth curves, exact data.</span></div><button class="icon-button code-toggle" id="code-toggle" aria-label="Show chart code" aria-pressed="false">${icon('code', 18)}</button></div>

          <div class="chart-card" id="chart-card">
            <div class="chart-header"><div><div class="chart-title-row"><span class="chart-title" id="chart-title">Revenue overview</span><span class="sample-label">SAMPLE DATA</span></div><div class="metric-row"><strong id="metric">$48,290</strong><span class="growth" id="growth">↗ 12.8%</span></div><p id="metric-caption">A good year in the making.</p></div><div class="period-switch" role="group" aria-label="Time period"><button class="selected" data-period="monthly" aria-pressed="true">12 months</button><button data-period="weekly" aria-pressed="false">7 days</button></div></div>
            <div class="chart-legend" id="chart-legend"><span><i></i>Revenue</span><span class="legend-note">Jan — Dec 2026</span></div>
            <div id="main-chart"></div>
            <div class="code-view" id="code-view" hidden><div class="code-filename"><span>your-chart.ts</span><span>TypeScript</span></div><pre><code id="code-content"></code></pre><button class="small-button" id="copy-code">${icon('copy', 14)} Copy code</button></div>
            <div class="chart-footnote"><span>${icon('spark', 13)}<span id="click-feedback" role="status" aria-live="polite">Click a point to see its details.</span></span><button id="shuffle" class="text-button">${icon('shuffle', 14)} Shuffle data</button></div>
          </div>
          <div class="canvas-footer"><span><span class="tiny-dot"></span> Responsive by nature. Crisp at every size.</span><div><button id="replay" class="text-button">${icon('replay', 14)} Replay</button><span class="divider"></span><button id="export" class="text-button">${icon('download', 14)} Export SVG</button></div></div>
        </div>

        <aside class="controls" aria-label="Chart settings">
          <div class="controls-heading"><h3>Make it yours</h3><button id="reset" class="text-button">Reset</button></div>
          <div class="control-field"><label for="dataset">Dataset</label><div class="select-wrap"><select id="dataset"><option value="revenue">Revenue</option><option value="visitors">Visitors</option><option value="subscriptions">Subscriptions</option></select></div></div>
          <div class="control-field"><div class="control-label"><label>Color palette</label><span id="palette-name">Vivid</span></div><div class="swatches" role="group" aria-label="Color palette">
            <button class="swatch selected" data-palette="vivid" style="--swatch:#27bd83" aria-label="Vivid palette" aria-pressed="true">${icon('check', 16)}</button>
            <button class="swatch" data-palette="violet" style="--swatch:#9066f4" aria-label="Violet palette" aria-pressed="false">${icon('check', 16)}</button>
            <button class="swatch" data-palette="coral" style="--swatch:#fa4768" aria-label="Coral palette" aria-pressed="false">${icon('check', 16)}</button>
            <button class="swatch" data-palette="amber" style="--swatch:#ff9e24" aria-label="Amber palette" aria-pressed="false">${icon('check', 16)}</button>
            <button class="swatch" data-palette="blue" style="--swatch:#3982f7" aria-label="Blue palette" aria-pressed="false">${icon('check', 16)}</button>
          </div></div>
          <div class="control-field"><label>Appearance</label><div class="appearance-switch" role="group" aria-label="Chart appearance"><button class="selected" data-theme="light" aria-pressed="true">${icon('sun', 15)}Light</button><button data-theme="dark" aria-pressed="false">${icon('moon', 15)}Dark</button></div></div>
          <div class="control-field radius-field"><div class="control-label"><label for="radius">Corner radius</label><output for="radius" id="radius-value">5 px</output></div><input type="range" id="radius" min="0" max="16" value="5"/><div class="range-labels"><span>Sharp</span><span>Soft</span></div></div>
          <div class="control-field line-width-field"><div class="control-label"><label for="stroke-width">Line width</label><output for="stroke-width" id="stroke-width-value">3 px</output></div><input type="range" id="stroke-width" min="1" max="6" step="0.5" value="3"/><div class="range-labels"><span>Fine</span><span>Bold</span></div></div><div class="controls-divider"></div>
          <label class="toggle-row" for="animate"><span>Entrance animation<small>A gentle hello for your data.</small></span><input type="checkbox" id="animate" role="switch" checked><span class="toggle-track"></span></label>
          <label class="toggle-row points-toggle-row" for="points"><span>Show points</span><input type="checkbox" id="points" role="switch" checked><span class="toggle-track"></span></label>
          <label class="toggle-row" for="grid"><span>Grid lines</span><input type="checkbox" id="grid" role="switch" checked><span class="toggle-track"></span></label>
          <label class="toggle-row" for="values"><span>Show values</span><input type="checkbox" id="values" role="switch"><span class="toggle-track"></span></label>
          <details class="extra-controls"><summary>Fill, size &amp; scale</summary>
            <label class="toggle-row fill-toggle-row" for="fill"><span>Area fill</span><input type="checkbox" id="fill" role="switch" checked><span class="toggle-track"></span></label>
            <label class="toggle-row" for="compact"><span>Mini chart</span><input type="checkbox" id="compact" role="switch"><span class="toggle-track"></span></label>
            <div class="control-field"><label for="tooltip-mode">Tooltip</label><div class="select-wrap"><select id="tooltip-mode"><option value="default">Default</option><option value="custom">Custom text</option><option value="off">Off</option></select></div></div>
            <div class="scale-fields"><div><label for="scale-min">Minimum</label><input id="scale-min" type="number" step="any" placeholder="Auto" aria-describedby="scale-error"></div><div><label for="scale-max">Maximum</label><input id="scale-max" type="number" step="any" placeholder="Auto" aria-describedby="scale-error"></div></div>
            <p id="scale-error" role="alert" hidden></p>
          </details><div class="settings-note">A few good options.<br>Infinite ways to make them yours.</div>
        </aside>
      </div>
    </section>

    <section class="examples" id="examples" aria-labelledby="examples-title"><div class="section-heading"><div class="section-title"><span class="section-index">02 /</span><h2 id="examples-title">Same data. Different stories.</h2></div><span class="section-subtitle">A couple of possibilities.</span></div>
      <div class="example-grid">
      <article class="example-card line-example"><div class="example-top"><div><span class="example-kicker">STRAIGHT TO THE POINT</span><h3>Every turn, in focus.</h3></div><span class="example-tag">Sharp line</span></div><div class="example-meta"><strong>Straight segments. Distinct corners.</strong><code>curve: 'linear'</code></div><div id="example-linear"></div></article>
      <article class="example-card line-example"><div class="example-top"><div><span class="example-kicker">A SMOOTHER PERSPECTIVE</span><h3>Let the story flow.</h3></div><span class="example-tag">Curved line</span></div><div class="example-meta"><strong>Soft fill. Smooth curves.</strong><code>fill: true</code></div><div id="example-smooth"></div></article>
      <article class="example-card"><div class="example-top"><div><span class="example-kicker">LESS NOISE, MORE SIGNAL</span><h3>Room for a little growth.</h3></div><span class="example-tag">Grouped</span></div><div class="example-meta"><strong>Built for comparison.</strong><div class="mini-legend"><span><i style="background:#9066f4"></i>This year</span><span><i style="background:#fa4768"></i>Last year</span></div></div><div id="example-grouped"></div></article>
      <article class="example-card"><div class="example-top"><div><span class="example-kicker">EVERY COLOR TELLS A STORY</span><h3>A brighter way to see it.</h3></div><span class="example-tag">Stacked</span></div><div class="example-meta"><strong>Seven days. Four little categories.</strong><span class="example-detail">Weekly spending</span></div><div id="example-stacked"></div><div class="spending-legend"><span><i style="background:#27bd83"></i>Food &amp; Drink</span><span><i style="background:#9066f4"></i>Grocery</span><span><i style="background:#fa4768"></i>Shopping</span><span><i style="background:#ff9e24"></i>Transport</span></div></article></div>
      <div class="mini-example-grid">
        <article class="mini-example-card"><div><span class="example-kicker">A LITTLE MOMENTUM</span><h3>Weekly activity</h3><strong>411 <small>visits</small></strong></div><div id="example-mini-line"></div></article>
        <article class="mini-example-card"><div><span class="example-kicker">SMALL SPACE, FULL STORY</span><h3>Daily orders</h3><strong>128 <small>orders</small></strong></div><div id="example-mini-bar"></div></article>
      </div>
    </section>

    <section id="quick-start" class="quick-start" aria-labelledby="quick-start-title"><div class="quick-copy"><div class="eyebrow"><span class="small-line"></span> SMALL API. BIG LITTLE DETAILS.</div><h2 id="quick-start-title">A few lines.<br>That's it.</h2><p>Give it a home and some data.<br>We'll take care of the good-looking part.</p><div class="feature-checks"><span>${icon('check', 14)} Any framework</span><span>${icon('check', 14)} TypeScript ready</span><span>${icon('check', 14)} Keyboard accessible</span></div><button id="open-docs" class="docs-button" aria-expanded="false" aria-controls="api-docs">Explore the API ${icon('right')}</button></div><div class="quick-code"><div class="code-filename"><span><i></i> hello-charto.ts</span><button id="copy-quick" class="text-button" aria-label="Copy quick start code">${icon('copy', 15)} Copy</button></div><pre><code><span class="syntax-purple">import</span> { lineChart } <span class="syntax-purple">from</span> <span class="syntax-green">'@arsennur/charto'</span>;

<span class="syntax-muted">// A small chart with a little character.</span>
<span class="syntax-purple">const</span> chart = <span class="syntax-function">lineChart</span>(<span class="syntax-green">'#chart'</span>, {
  data: [
    { label: <span class="syntax-green">'Mon'</span>, value: <span class="syntax-orange">120</span> },
    { label: <span class="syntax-green">'Tue'</span>, value: <span class="syntax-orange">190</span> },
    { label: <span class="syntax-green">'Wed'</span>, value: <span class="syntax-orange">160</span> },
  ],
  curve: <span class="syntax-green">'smooth'</span>,
  color: <span class="syntax-green">'#27bd83'</span>,
});</code></pre><div class="quick-code-footer">No providers. No stylesheet imports. Just charts.<span>ESM</span></div></div></section>
    <section id="api-docs" class="api-docs" hidden aria-label="API documentation"><div><h3>Bring Charto into your project</h3><p>This is a local package. Run <code>npm pack</code> in this project, install the generated <code>.tgz</code> in your app, then import <code>barChart</code> or <code>lineChart</code>. It has no runtime dependencies. In a plain HTML page, import the built <code>dist/charto.js</code> directly.</p><p>Create a container such as <code>&lt;div id="chart"&gt;&lt;/div&gt;</code>. Create your chart after it mounts and <code>chart.destroy()</code> when it unmounts.</p></div><div><h3>Two charts. One familiar API.</h3><dl><dt>data</dt><dd>Labels and values. Use value arrays for multiple series.</dd><dt>series</dt><dd>Names and colors for multiple series.</dd><dt>onClick</dt><dd>Handle a bar, segment, or point click with its value, category, and series.</dd><dt>curve / strokeWidth / points / fill</dt><dd>Line style, thickness, markers, and gradient fill.</dd><dt>compact</dt><dd>Small charts without axes, grid, or labels.</dd><dt>tooltip</dt><dd>true, false, or a function returning tooltip text.</dd><dt>min / max</dt><dd>Fixed scale boundaries. Omit for automatic scaling.</dd><dt>orientation / mode</dt><dd>vertical or horizontal; grouped or stacked.</dd><dt>color / theme / radius</dt><dd>Your visual language, with thoughtful defaults.</dd><dt>animate / grid / labels / values</dt><dd>Simple switches for motion and detail.</dd><dt>height / label / formatValue</dt><dd>Chart height, accessible name, and number formatting.</dd></dl><p><code>chart.update(options)</code> · <code>chart.replay()</code><br><code>chart.toSVG()</code> · <code>chart.destroy()</code></p><p>Stacked bars round the outer corners and keep internal joins flush. Set radius to 0 for square corners.</p></div></section>
  </main>
  <footer class="site-footer"><a href="#" class="brand">${logo}<span>charto.</span></a><span>A small thing, made with care.</span><span>Less code. More clarity.</span></footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`;

type Family = 'bar' | 'line';
type Kind = 'vertical' | 'horizontal' | 'grouped' | 'stacked';
type Dataset = 'revenue' | 'visitors' | 'subscriptions';
const palettes: Record<string, { name: string; colors: string[] }> = {
  vivid: { name: 'Vivid', colors: ['#27bd83', '#9066f4', '#fa4768', '#ff9e24'] },
  violet: { name: 'Violet', colors: ['#9066f4', '#fa4768', '#3982f7', '#ff9e24'] },
  coral: { name: 'Coral', colors: ['#fa4768', '#ff9e24', '#9066f4', '#27bd83'] },
  amber: { name: 'Amber', colors: ['#ff9e24', '#fa4768', '#27bd83', '#9066f4'] },
  blue: { name: 'Blue', colors: ['#3982f7', '#9066f4', '#27bd83', '#fa4768'] },
};
const state = { family: 'line' as Family, curve: 'smooth' as 'linear' | 'smooth', strokeWidth: 3, points: true, fill: true, compact: false, tooltip: 'default' as 'default' | 'custom' | 'off', min: '', max: '', kind: 'vertical' as Kind, palette: 'vivid', theme: 'light' as 'light' | 'dark', dataset: 'revenue' as Dataset, period: 'monthly', radius: 5, animate: true, grid: true, values: false, code: false };
const baseData = [2440, 3150, 2740, 4010, 3500, 4580, 3870, 5030, 4450, 5480, 4130, 4910];
let sampleData = [...baseData];
let currentData: BarDatum[] = [];
let chart: BarChart | LineChart;
let renderedFamily: Family;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

function dataForState(): BarDatum[] {
  const labels = state.period === 'monthly' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const multiple = state.family === 'bar' && (state.kind === 'grouped' || state.kind === 'stacked');
  const scale = state.dataset === 'visitors' ? 7.4 : state.dataset === 'subscriptions' ? 0.075 : 1;
  return labels.map((label, index) => {
    const value = Math.round(sampleData[index] * scale * (state.period === 'weekly' ? 0.19 : 1));
    const organic = Math.round(value * 0.4);
    const direct = Math.round(value * 0.22);
    const referral = Math.round(value * 0.18);
    const split = state.kind === 'stacked'
      ? [organic, direct, referral, value - organic - direct - referral]
      : [Math.round(value * 0.67), value - Math.round(value * 0.67)];
    return { label, value: multiple ? split : value };
  });
}
function customTooltip({ label, value, seriesName }: ChartPoint): string {
  return `${label}${seriesName === 'Value' ? '' : ' · ' + seriesName}\n${state.dataset === 'revenue' ? '$' : ''}${value.toLocaleString('en')}\nClick to view details`;
}
function getOptions(): BarChartOptions & LineChartOptions {
  const multiple = state.family === 'bar' && (state.kind === 'grouped' || state.kind === 'stacked');
  return {
    data: currentData,
    color: palettes[state.palette].colors[0],
    series: multiple
      ? (state.kind === 'stacked' ? ['Organic', 'Direct', 'Referral', 'Social'] : ['Organic', 'Direct'])
        .map((name, index) => ({ name, color: palettes[state.palette].colors[index] }))
      : undefined,
    orientation: state.kind === 'horizontal' ? 'horizontal' : 'vertical',
    mode: state.kind === 'stacked' ? 'stacked' : 'grouped',
    theme: state.theme,
    height: state.compact ? 80 : state.family === 'bar' && state.kind === 'horizontal' && state.period === 'monthly' ? 350 : 290,
    radius: state.radius,
    curve: state.curve,
    strokeWidth: state.strokeWidth,
    points: state.points,
    fill: state.fill,
    compact: state.compact,
    tooltip: state.tooltip === 'off' ? false : state.tooltip === 'custom' ? customTooltip : true,
    min: state.min === '' ? undefined : Number(state.min),
    max: state.max === '' ? undefined : Number(state.max),
    animate: state.animate,
    grid: state.grid,
    values: state.values,
    label: `${state.dataset} by ${state.period === 'monthly' ? 'month' : 'day'}`,
    formatValue: state.dataset === 'revenue' ? (value: number) => '$' + new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : undefined,
    onClick: ({ label, value, seriesName }) => {
      const name = seriesName === 'Value' ? '' : ` · ${seriesName}`;
      $('#click-feedback').textContent = `${label}${name} — ${state.dataset === 'revenue' ? '$' : ''}${value.toLocaleString('en')}`;
    },
  };
}
function codeForState(): string {
  const options = getOptions();
  const factory = state.family === 'line' ? 'lineChart' : 'barChart';
  const lines = [`import { ${factory} } from '@arsennur/charto';`, '', `const chart = ${factory}('#chart', {`, '  data: [', ...currentData.map(datum => `    { label: '${datum.label}', value: ${JSON.stringify(datum.value)} },`), '  ],', `  color: '${options.color}',`];
  if (options.series) lines.push('  series: ' + JSON.stringify(options.series) + ',');
  if (state.family === 'bar' && options.orientation === 'horizontal') lines.push("  orientation: 'horizontal',");
  if (state.family === 'bar' && options.mode === 'stacked') lines.push("  mode: 'stacked',");
  if (state.family === 'line') lines.push(`  curve: '${state.curve}',`, `  strokeWidth: ${state.strokeWidth},`, `  points: ${state.points},`, `  fill: ${state.fill},`);
  else lines.push(`  radius: ${state.radius},`);
  lines.push(`  height: ${options.height},`, `  label: '${options.label}',`);
  if (state.theme !== 'light') lines.push("  theme: 'dark',");
  if (state.compact) lines.push('  compact: true,');
  if (options.min !== undefined) lines.push(`  min: ${options.min},`);
  if (options.max !== undefined) lines.push(`  max: ${options.max},`);
  if (state.tooltip === 'off') lines.push('  tooltip: false,');
  if (state.tooltip === 'custom') lines.push("  tooltip: ({ label, value, seriesName }) =>", "    label + (seriesName === 'Value' ? '' : ' · ' + seriesName) + '\\n' +", `    '${state.dataset === 'revenue' ? '$' : ''}' + value.toLocaleString('en') + '\\nClick to view details',`);
  if (!state.animate) lines.push('  animate: false,');
  if (!state.grid) lines.push('  grid: false,');
  if (state.values) lines.push('  values: true,');
  if (state.dataset === 'revenue') lines.push("  formatValue: value => '$' + new Intl.NumberFormat('en', {", "    notation: 'compact', maximumFractionDigits: 1,", '  }).format(value),');
  lines.push('  onClick: ({ label, value, dataIndex, seriesIndex }) => {', '    console.log({ label, value, dataIndex, seriesIndex });', '  },');
  lines.push('});');
  return lines.join('\n');
}

function render(): void {
  currentData = dataForState();
  const options = getOptions();
  if (!chart || renderedFamily !== state.family) {
    chart?.destroy();
    chart = state.family === 'line' ? lineChart('#main-chart', options) : barChart('#main-chart', options);
    renderedFamily = state.family;
  } else chart.update(options);
  $('#chart-card').classList.toggle('dark', state.theme === 'dark');
  $('#chart-card').classList.toggle('compact-card', state.compact);
  $('#chart-legend').hidden = state.compact;
  const total = currentData.reduce((sum, datum) => sum + (Array.isArray(datum.value) ? datum.value.reduce((a, b) => a + b, 0) : datum.value), 0);
  const names = { revenue: 'Revenue', visitors: 'Visitors', subscriptions: 'Subscriptions' };
  $('#chart-title').textContent = `${names[state.dataset]} overview`;
  $('#metric').textContent = (state.dataset === 'revenue' ? '$' : '') + total.toLocaleString('en');
  $('#metric-caption').textContent = state.period === 'monthly' ? 'A good year in the making.' : 'Small steps. A pretty good week.';
  const values = currentData.map(datum => Array.isArray(datum.value) ? datum.value.reduce((a, b) => a + b, 0) : datum.value);
  const previous = values.at(-2) ?? 1;
  const change = previous === 0 ? 0 : (values.at(-1)! - previous) / previous * 100;
  $('#growth').textContent = `${change >= 0 ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`;
  $('#growth').classList.toggle('negative', change < 0);
  $('#growth').title = `Compared with the previous ${state.period === 'monthly' ? 'month' : 'day'}`;
  const legend = $('#chart-legend');
  legend.replaceChildren();
  (options.series ?? [{ name: names[state.dataset], color: options.color }]).forEach(series => {
    const span = document.createElement('span');
    const dot = document.createElement('i'); dot.style.background = series.color!;
    span.append(dot, series.name); legend.append(span);
  });
  const note = document.createElement('span'); note.className = 'legend-note'; note.textContent = state.period === 'monthly' ? 'Jan — Dec 2026' : 'Mon — Sun'; legend.append(note);
  $('#palette-name').textContent = palettes[state.palette].name;
  $('#radius-value').textContent = `${state.radius} px`;
  $('#code-content').textContent = codeForState();
  $('#code-view').hidden = !state.code;
  $('#main-chart').hidden = state.code;
  $('#code-toggle').setAttribute('aria-pressed', String(state.code));
  $('#code-toggle').setAttribute('aria-label', state.code ? 'Show chart preview' : 'Show chart code');
  $('#code-toggle').innerHTML = icon(state.code ? 'eye' : 'code', 18);
  $('#replay').toggleAttribute('disabled', !state.animate || state.code);
  const isLine = state.family === 'line';
  $('#click-feedback').textContent = `Click a ${isLine ? 'point' : state.kind === 'stacked' ? 'segment' : 'bar'} to see its details.`;
  $('#bar-tabs').hidden = isLine;
  $('#line-tabs').hidden = !isLine;
  $('.radius-field').hidden = isLine;
  $('.line-width-field').hidden = !isLine;
  $('.points-toggle-row').hidden = !isLine;
  $('.fill-toggle-row').hidden = !isLine;
  $<HTMLInputElement>('#grid').disabled = state.compact;
  $('#stroke-width-value').textContent = `${state.strokeWidth} px`;
  $('#line-style-note').textContent = state.curve === 'smooth' ? 'Smooth curves, exact data.' : 'Straight lines, clear turns.';
  const stacked = !isLine && state.kind === 'stacked';
  $<HTMLInputElement>('#values').disabled = stacked || state.compact;
  $('.radius-field').title = stacked ? 'Rounds the outside corners while keeping segment joins flush.' : '';
  document.querySelectorAll<HTMLButtonElement>('[data-family], [data-curve]').forEach(button => {
    const active = button.dataset.family ? button.dataset.family === state.family : button.dataset.curve === state.curve;
    button.classList.toggle(button.dataset.curve ? 'active' : 'selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kind], [data-palette], [data-theme], [data-period]').forEach(button => {
    const active = button.dataset.kind ? button.dataset.kind === state.kind : button.dataset.palette ? button.dataset.palette === state.palette : button.dataset.theme ? button.dataset.theme === state.theme : button.dataset.period === state.period;
    button.classList.toggle(button.dataset.kind ? 'active' : 'selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(button => button.addEventListener('click', () => { state.family = button.dataset.family as Family; render(); }));
document.querySelectorAll<HTMLButtonElement>('[data-curve]').forEach(button => button.addEventListener('click', () => { state.curve = button.dataset.curve as 'linear' | 'smooth'; render(); }));
$('#stroke-width').addEventListener('input', event => { state.strokeWidth = Number((event.target as HTMLInputElement).value); render(); });
document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => button.addEventListener('click', () => { state.kind = button.dataset.kind as Kind; render(); }));
document.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(button => button.addEventListener('click', () => { state.palette = button.dataset.palette!; render(); }));
document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(button => button.addEventListener('click', () => { state.theme = button.dataset.theme as 'light' | 'dark'; render(); }));
document.querySelectorAll<HTMLButtonElement>('[data-period]').forEach(button => button.addEventListener('click', () => { state.period = button.dataset.period!; render(); }));
$('#dataset').addEventListener('change', event => { state.dataset = (event.target as HTMLSelectElement).value as Dataset; render(); });
$('#radius').addEventListener('input', event => { state.radius = Number((event.target as HTMLInputElement).value); render(); });
(['animate', 'grid', 'values', 'points', 'fill', 'compact'] as const).forEach(key => $('#' + key).addEventListener('change', event => { state[key] = (event.target as HTMLInputElement).checked; render(); }));
$('#tooltip-mode').addEventListener('change', event => { state.tooltip = (event.target as HTMLSelectElement).value as typeof state.tooltip; render(); });
function updateBounds(): void {
  const minInput = $<HTMLInputElement>('#scale-min');
  const maxInput = $<HTMLInputElement>('#scale-max');
  const min = minInput.value === '' ? undefined : Number(minInput.value);
  const max = maxInput.value === '' ? undefined : Number(maxInput.value);
  const invalid = minInput.validity.badInput || maxInput.validity.badInput || [min, max].some(value => value !== undefined && (!Number.isFinite(value) || Math.abs(value) > 1e100));
  const message = invalid ? 'Enter a finite number between -1e100 and 1e100.' : min !== undefined && max !== undefined && min >= max ? 'Minimum must be less than maximum.' : '';
  $('#scale-error').textContent = message;
  $('#scale-error').hidden = !message;
  if (message) return;
  state.min = minInput.value;
  state.max = maxInput.value;
  render();
}
$('#scale-min').addEventListener('input', updateBounds);
$('#scale-max').addEventListener('input', updateBounds);
$('#code-toggle').addEventListener('click', () => { state.code = !state.code; render(); });
$('#replay').addEventListener('click', () => chart.replay());
$('#shuffle').addEventListener('click', () => { sampleData = baseData.map(value => Math.round(value * (0.65 + Math.random() * 0.7))); render(); });
$('#reset').addEventListener('click', () => {
  Object.assign(state, { family: 'line', curve: 'smooth', strokeWidth: 3, points: true, fill: true, compact: false, tooltip: 'default' as 'default' | 'custom' | 'off', min: '', max: '', kind: 'vertical', palette: 'vivid', theme: 'light', dataset: 'revenue', period: 'monthly', radius: 5, animate: true, grid: true, values: false, code: false });
  sampleData = [...baseData];
  $<HTMLSelectElement>('#dataset').value = 'revenue';
  $<HTMLSelectElement>('#tooltip-mode').value = 'default';
  $<HTMLInputElement>('#scale-min').value = '';
  $<HTMLInputElement>('#scale-max').value = '';
  $('#scale-error').hidden = true;
  $<HTMLInputElement>('#radius').value = '5';
  $<HTMLInputElement>('#stroke-width').value = '3';
  (['animate', 'grid', 'values', 'points', 'fill', 'compact'] as const).forEach(key => { $<HTMLInputElement>('#' + key).checked = state[key]; });
  render();
});
let toastTimeout: ReturnType<typeof setTimeout>;
function toast(message: string): void { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 2500); }
async function copy(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); toast('Copied. Go make something good.'); }
  catch { toast('Clipboard is unavailable. Select and copy the code instead.'); }
}
$('#copy-code').addEventListener('click', () => void copy(codeForState()));
$('#copy-quick').addEventListener('click', () => void copy($('.quick-code pre').textContent!));
$('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([chart.toSVG()], { type: 'image/svg+xml' }));
  const link = document.createElement('a'); link.href = url; link.download = `charto-${state.family === 'line' ? 'line-' + state.curve : state.kind}.svg`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Your chart, ready to go.');
});
$('#open-docs').addEventListener('click', () => {
  const open = $('#api-docs').hidden;
  $('#api-docs').hidden = !open;
  $('#open-docs').setAttribute('aria-expanded', String(open));
  if (open) $('#api-docs').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});
if (bundleSize.gzip) { $('#bundle-size').textContent = `${(bundleSize.gzip / 1024).toFixed(1)} kB`; $('#bundle-suffix').textContent = ' gzipped'; }
render();
const comparisonData = [32, 54, 42, 76, 58, 84, 65].map((value, index) => ({ label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index], value }));
const exampleClick = ({ label, value, seriesName }: ChartClickEvent): void => toast(`${label}${seriesName === 'Value' ? '' : ' · ' + seriesName} — ${value.toLocaleString('en')}`);
const examples = [
  lineChart('#example-mini-line', { data: comparisonData, compact: true, fill: true, points: false, color: '#9066f4', min: 0, max: 100, onClick: exampleClick, label: 'Weekly activity sparkline' }),
  barChart('#example-mini-bar', { data: comparisonData.map((datum, index) => ({ label: datum.label, value: [10, 14, 8, 24, 17, 29, 26][index] })), compact: true, color: '#27bd83', radius: 3, onClick: exampleClick, label: 'Daily orders sparkline' }),
  lineChart('#example-linear', { data: comparisonData, curve: 'linear', color: '#9066f4', height: 200, label: 'Daily activity with sharp corners', onClick: exampleClick }),
  lineChart('#example-smooth', { data: comparisonData, curve: 'smooth', points: false, fill: true, color: '#27bd83', height: 200, label: 'Daily activity with smooth curves', onClick: exampleClick }),
  barChart('#example-grouped', { data: ['Q1', 'Q2', 'Q3', 'Q4'].map((label, index) => ({ label, value: [[34, 24], [52, 38], [45, 32], [68, 49]][index] })), series: [{ name: 'This year', color: '#9066f4' }, { name: 'Last year', color: '#fa4768' }], height: 190, radius: 4, label: 'Quarterly growth comparison', onClick: exampleClick }),
  barChart('#example-stacked', {
    data: [[22, 15, 15, 32], [16, 12, 11, 11], [53, 15, 15, 17], [18, 20, 18, 14], [13, 9, 9, 19], [22, 15, 15, 32], [22, 15, 15, 18]]
      .map((value, index) => ({ label: String(index + 1).padStart(2, '0'), value })),
    series: ['Food & Drink', 'Grocery', 'Shopping', 'Transport'].map((name, index) => ({ name, color: palettes.vivid.colors[index] })),
    mode: 'stacked', radius: 8, height: 190, label: 'Weekly spending by category', onClick: exampleClick,
  }),
];
if (import.meta.hot) import.meta.hot.dispose(() => { chart.destroy(); examples.forEach(example => example.destroy()); clearTimeout(toastTimeout); });
