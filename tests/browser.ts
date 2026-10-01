import { barChart, lineChart, type BarChart, type BarChartOptions, type ChartClickEvent, type LineChart, type LineChartOptions } from '../src/index.ts';

const fixture = document.querySelector<HTMLElement>('#fixture')!;
const results = document.querySelector('#results')!;
let passed = 0;
let failed = 0;
let chart: BarChart | LineChart | undefined;
const assert = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };
const bars = (): SVGRectElement[] => [...fixture.querySelectorAll<SVGRectElement>('[data-charto-bar]')];
const create = (patch: Partial<BarChartOptions> = {}): BarChart => {
  chart = barChart(fixture, { data: [{ label: 'A', value: 20 }, { label: 'B', value: 40 }], animate: false, ...patch });
  return chart;
};
const createLine = (patch: Partial<LineChartOptions> = {}): LineChart => {
  chart = lineChart(fixture, { data: [{ label: 'A', value: 20 }, { label: 'B', value: 40 }, { label: 'C', value: 10 }], animate: false, ...patch });
  return chart;
};
const line = (): SVGPathElement => fixture.querySelector<SVGPathElement>('[data-charto-line]')!;
const points = (): SVGCircleElement[] => [...fixture.querySelectorAll<SVGCircleElement>('[data-charto-point]')];
async function rasterize(instance: { toSVG(): string }): Promise<(x: number, y: number) => boolean> {
  const url = URL.createObjectURL(new Blob([instance.toSVG()], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    return (x, y) => {
      const [r, g, b] = context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      return r > 245 && g > 245 && b > 245;
    };
  } finally { URL.revokeObjectURL(url); }
}
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  fixture.style.width = '640px';
  const row = document.createElement('li');
  try { await fn(); row.textContent = `PASS — ${name}`; row.className = 'pass'; passed++; }
  catch (error) { row.textContent = `FAIL — ${name}: ${String(error)}`; row.className = 'fail'; failed++; }
  finally { chart?.destroy(); chart = undefined; fixture.replaceChildren(); }
  results.append(row);
}

await test('vertical bars preserve the 1:2 data ratio', () => {
  create(); const [a, b] = bars();
  assert(Math.abs(Number(b.getAttribute('height')) / Number(a.getAttribute('height')) - 2) < 0.001, 'incorrect bar ratio');
});
await test('horizontal bars preserve the 1:2 data ratio', () => {
  create({ orientation: 'horizontal' }); const [a, b] = bars();
  assert(Math.abs(Number(b.getAttribute('width')) / Number(a.getAttribute('width')) - 2) < 0.001, 'incorrect bar ratio');
});
await test('grouped bars remain separate and share a baseline', () => {
  create({ data: [{ label: 'A', value: [20, 40] }] }); const [a, b] = bars();
  assert(a.getAttribute('x') !== b.getAttribute('x'), 'groups overlap');
  assert(Number(a.getAttribute('y')) + Number(a.getAttribute('height')) === Number(b.getAttribute('y')) + Number(b.getAttribute('height')), 'unequal baselines');
});
await test('stacked segments meet without a gap', () => {
  create({ mode: 'stacked', data: [{ label: 'A', value: [20, 40] }] }); const [a, b] = bars();
  assert(a.getAttribute('x') === b.getAttribute('x'), 'segments not aligned');
  assert(Math.abs(Number(a.getAttribute('y')) - Number(b.getAttribute('y')) - Number(b.getAttribute('height'))) < 0.001, 'segments do not meet');
});
await test('mixed positive and negative stacks are inside the SVG', () => {
  create({ mode: 'stacked', data: [{ label: 'A', value: [20, -40, 30, -10] }] });
  for (const rect of bars()) assert(Number(rect.getAttribute('y')) >= 0 && Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')) <= 320, 'bar outside chart');
});
for (const orientation of ['vertical', 'horizontal'] as const) {
  await test(`${orientation} stacks export rounded outer corners and flat internal joins`, async () => {
    const instance = create({ mode: 'stacked', orientation, grid: false, labels: false, radius: 12 });
    for (const value of [[20, 20, 20], [-20, -20, -20], [20, -40, 30, -10]]) {
      instance.update({ data: [{ label: 'A', value }], radius: 12 });
      const bounds = bars().map(rect => ({ x: rect.x.baseVal.value, y: rect.y.baseVal.value, width: rect.width.baseVal.value, height: rect.height.baseVal.value }));
      const left = Math.min(...bounds.map(b => b.x));
      const right = Math.max(...bounds.map(b => b.x + b.width));
      const top = Math.min(...bounds.map(b => b.y));
      const bottom = Math.max(...bounds.map(b => b.y + b.height));
      const isWhite = await rasterize(instance);
      for (const x of [left + 1.5, right - 1.5]) {
        for (const y of [top + 1.5, bottom - 1.5]) assert(isWhite(x, y), 'outside corner is still square');
      }
      assert(!isWhite((left + right) / 2, (top + bottom) / 2), 'stack is missing from the export');
      for (const b of bounds) {
        const start = orientation === 'vertical' ? b.y : b.x;
        const min = orientation === 'vertical' ? top : left;
        const max = orientation === 'vertical' ? bottom : right;
        if (start > min + 16 && start < max - 16) {
          for (const offset of [-2, 2]) {
            assert(!isWhite(orientation === 'vertical' ? left + 1.5 : start + offset, orientation === 'vertical' ? start + offset : top + 1.5), 'internal join has a rounded gap');
          }
        }
      }
      instance.update({ radius: 0 });
      const squareIsWhite = await rasterize(instance);
      assert(!squareIsWhite(left + 1.5, top + 1.5) && !squareIsWhite(right - 1.5, bottom - 1.5), 'radius 0 did not restore square corners');
    }
  });
}
await test('rounded stacks keep clipping independent across instances and updates', () => {
  const instance = create({ mode: 'stacked', data: [{ label: 'A', value: [20, 40] }] });
  const other = barChart(fixture, { mode: 'stacked', data: [{ label: 'B', value: [10, 5] }], radius: 16, animate: false });
  try {
    instance.update({ radius: 8 });
    const ids = [...fixture.querySelectorAll('clipPath')].map(clip => clip.id);
    assert(ids.length === 2 && new Set(ids).size === 2, 'clipping IDs collide');
    for (const svg of fixture.querySelectorAll('svg')) {
      const clip = svg.querySelector('clipPath')!;
      assert(svg.querySelector('[data-charto-stack]')?.getAttribute('clip-path') === `url(#${clip.id})`, 'stack references another chart');
    }
  } finally { other.destroy(); }
});
await test('stacked segments animate together and respect the animation setting', () => {
  const instance = create({ mode: 'stacked', data: [{ label: 'A', value: [20, 40] }], animate: true });
  const stack = fixture.querySelector('[data-charto-stack]')!;
  assert(stack.getAnimations().length === (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1), 'stack animation ignores motion settings');
  assert(bars().every(bar => bar.getAnimations().length === 0), 'segments animate apart');
  instance.update({ animate: false });
  assert(fixture.querySelector('[data-charto-stack]')!.getAnimations().length === 0, 'stack animation remains enabled');
});
await test('updates replace data without leaving old nodes', () => {
  const instance = create(); instance.update({ data: [{ label: 'Only', value: 9 }] });
  assert(bars().length === 1 && bars()[0].getAttribute('aria-label') === 'Only: 9', 'update did not replace data');
  assert(fixture.querySelectorAll('svg').length === 1, 'duplicate SVG');
});
await test('invalid updates preserve the previous chart', () => {
  const instance = create(); const before = instance.toSVG(); let threw = false;
  try { instance.update({ data: [{ label: 'Bad', value: NaN }] }); } catch { threw = true; }
  assert(threw && instance.toSVG() === before, 'invalid update destroyed the chart');
});
await test('undefined optional settings restore safe defaults', () => {
  const instance = create({ height: undefined, radius: undefined, theme: undefined });
  instance.update({ height: undefined, radius: undefined, theme: undefined });
  assert(!/NaN|Infinity|undefined/.test(instance.toSVG()), 'undefined default generated invalid SVG');
  assert(fixture.querySelector('svg')?.getAttribute('height') === '320', 'default height not restored');
});
await test('empty data renders a useful empty state', () => {
  create({ data: [] }); assert(fixture.textContent?.includes('No data yet') && bars().length === 0, 'missing empty state');
});
await test('zero values never create NaN or Infinity geometry', () => {
  const instance = create({ data: [{ label: 'Zero', value: 0 }] });
  assert(!/NaN|Infinity/.test(instance.toSVG()), 'invalid SVG coordinates');
});
await test('tooltips and data tables treat labels as plain text', () => {
  create({ data: [{ label: '<img src=x onerror=alert(1)>', value: 20 }] });
  bars()[0].dispatchEvent(new FocusEvent('focus'));
  assert(fixture.querySelectorAll('img').length === 0, 'label interpreted as markup');
  assert(fixture.querySelector('[role=tooltip]')?.textContent?.includes('<img'), 'tooltip lost original label');
});
await test('keyboard arrows move focus and Escape closes the tooltip', () => {
  create(); bars()[0].focus();
  bars()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert(document.activeElement === bars()[1], 'focus did not move');
  bars()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert(fixture.querySelector<HTMLElement>('[role=tooltip]')!.hidden, 'tooltip is still visible');
});
await test('screen-reader table contains names and exact values', () => {
  create({ data: [{ label: 'Sales', value: [2043, 3.14259] }], series: [{ name: 'Online' }, { name: 'Retail' }], label: 'Sales report' });
  const table = fixture.querySelector('table')!;
  assert(table.caption?.textContent === 'Sales report' && table.textContent?.includes('Online') && table.textContent?.includes('3.14259'), 'accessible data missing');
});
await test('SVG export is standalone XML with a background', () => {
  const instance = create({ theme: 'dark' }); const xml = new DOMParser().parseFromString(instance.toSVG(), 'image/svg+xml');
  assert(!xml.querySelector('parsererror'), 'invalid XML');
  assert(xml.documentElement.getAttribute('width') === String(fixture.getBoundingClientRect().width), 'missing export width');
  assert(xml.querySelector('rect')?.getAttribute('fill') === '#18181b', 'missing background');
  assert(!xml.querySelector('[tabindex]'), 'export contains interactive focus targets');
});
await test('ResizeObserver updates the viewBox after container resize', async () => {
  create(); const before = fixture.querySelector('svg')!.getAttribute('viewBox'); fixture.style.width = '320px';
  await new Promise(resolve => setTimeout(resolve, 100));
  assert(fixture.querySelector('svg')!.getAttribute('viewBox') !== before, 'chart did not resize');
});
await test('animation setting and system reduced-motion preference are respected', () => {
  const instance = create({ animate: true });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  assert(bars()[0].getAnimations().length === (reduced ? 0 : 1), 'motion preference ignored');
  instance.update({ animate: false }); assert(bars()[0].getAnimations().length === 0, 'animation switch ignored');
});
await test('multiple chart instances have independent lifecycles', () => {
  const a = create(); const b = barChart(fixture, { data: [{ label: 'Other', value: 5 }], animate: false });
  a.destroy(); assert(fixture.querySelectorAll('svg').length === 1, 'destroy affected another chart'); b.destroy();
});
await test('destroy removes owned DOM and can safely be called twice', () => {
  const instance = create(); instance.destroy(); instance.destroy(); instance.update({ color: 'red' });
  assert(fixture.childElementCount === 0, 'DOM was not cleaned up');
  let threw = false; try { instance.toSVG(); } catch { threw = true; } assert(threw, 'export accepted destroyed instance');
});
await test('sharp line charts use straight segments and expose every point', () => {
  createLine({ curve: 'linear' });
  assert(line().getAttribute('d')?.includes('L') && !line().getAttribute('d')?.includes('C'), 'sharp line contains a curve');
  assert(points().length === 3 && fixture.querySelector('table')?.textContent?.includes('40'), 'point data missing');
});
await test('line mode can switch between smooth and sharp without duplicate SVGs', () => {
  const instance = createLine();
  assert(line().getAttribute('d')?.includes('C'), 'smooth is not the default');
  instance.update({ curve: 'linear' });
  assert(!line().getAttribute('d')?.includes('C'), 'smooth path was not replaced');
  instance.update({ curve: 'smooth' });
  assert(line().getAttribute('d')?.includes('C') && fixture.querySelectorAll('svg').length === 1, 'switch left duplicate charts');
});
await test('line markers default to visible and toggle for both curve modes', () => {
  const instance = createLine();
  assert(fixture.querySelectorAll('[data-charto-dot]').length === 3, 'default markers missing');
  for (const curve of ['linear', 'smooth'] as const) {
    instance.update({ curve, points: false });
    assert(!fixture.querySelector('[data-charto-dot]') && points().length === 3, 'hidden markers or point targets are incorrect');
    const path = line().getAttribute('d');
    instance.update({ points: true });
    assert(fixture.querySelectorAll('[data-charto-dot]').length === 3 && line().getAttribute('d') === path, 'markers changed the line geometry');
  }
  instance.update({ points: false });
  instance.update({ points: undefined });
  assert(fixture.querySelectorAll('[data-charto-dot]').length === 3, 'undefined did not restore default markers');
});
await test('hidden line markers preserve tooltips, keyboard access, and clean SVG exports', () => {
  const instance = createLine({ points: false });
  points()[0].dispatchEvent(new PointerEvent('pointerenter'));
  assert(fixture.querySelector('[role=tooltip]')?.textContent === 'A\n20', 'pointer tooltip missing');
  points()[0].focus();
  points()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert(document.activeElement === points()[1] && fixture.querySelector('[role=tooltip]')?.textContent === 'B\n40', 'keyboard tooltip missing');
  assert(!fixture.querySelector('[data-charto-dot]') && fixture.querySelector('table')?.textContent?.includes('40'), 'interaction restored hidden dots or lost accessible data');
  const xml = new DOMParser().parseFromString(instance.toSVG(), 'image/svg+xml');
  assert(!xml.querySelector('parsererror, circle') && xml.querySelector('[data-charto-line]'), 'export lost the line or restored hidden markers');
});
await test('line series receive independent colors and paths', () => {
  createLine({ data: [{ label: 'A', value: [20, 10] }, { label: 'B', value: [40, 30] }], series: [{ name: 'First', color: '#fa4768' }, { name: 'Second', color: '#9066f4' }] });
  const paths = [...fixture.querySelectorAll('[data-charto-line]')];
  assert(paths.length === 2 && paths[0].getAttribute('stroke') === '#fa4768' && paths[1].getAttribute('stroke') === '#9066f4', 'series colors missing');
});
await test('missing line values produce gaps instead of invented zero values', () => {
  createLine({ data: [{ label: 'A', value: 20 }, { label: 'B', value: [] }, { label: 'C', value: 40 }] });
  assert((line().getAttribute('d')?.match(/M/g) ?? []).length === 2, 'line bridges missing data');
  assert(points().length === 2 && fixture.querySelector('table')?.textContent?.includes('—'), 'missing values became zero');
});
await test('single-point, empty and zero line charts are valid', () => {
  const instance = createLine({ data: [{ label: 'Only', value: 0 }] });
  assert(points().length === 1 && !/NaN|Infinity/.test(instance.toSVG()), 'single point has invalid geometry');
  instance.update({ data: [] });
  assert(fixture.textContent?.includes('No data yet') && points().length === 0, 'line empty state missing');
});
await test('negative line values remain inside the chart bounds', () => {
  const instance = createLine({ data: [{ label: 'A', value: -50 }, { label: 'B', value: 20 }, { label: 'C', value: -10 }] });
  assert(!/NaN|Infinity/.test(instance.toSVG()), 'invalid signed path');
  points().forEach(point => assert(Number(point.getAttribute('cy')) >= 24 && Number(point.getAttribute('cy')) <= 284, 'point outside plot'));
});
await test('line point tooltips work with keyboard navigation', () => {
  createLine(); points()[0].focus(); points()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert(document.activeElement === points()[1], 'line focus did not move');
  assert(fixture.querySelector('[role=tooltip]')?.textContent === 'B\n40', 'wrong point tooltip');
  points()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert(fixture.querySelector<HTMLElement>('[role=tooltip]')!.hidden, 'line tooltip remains open');
});
await test('line SVG export retains full curves and removes pointer targets', () => {
  const instance = createLine({ animate: true });
  const xml = new DOMParser().parseFromString(instance.toSVG(), 'image/svg+xml');
  assert(!xml.querySelector('parsererror') && xml.querySelector('[data-charto-line]')?.getAttribute('d')?.includes('C'), 'curve export failed');
  assert(!xml.querySelector('[data-charto-hit]') && xml.querySelectorAll('[data-charto-dot]').length === 3, 'export contains interactive hit targets or loses points');
  assert(!xml.querySelector('[stroke-dashoffset]'), 'export contains an unfinished drawing animation');
});
await test('invalid line settings leave the existing chart intact', () => {
  const instance = createLine(); const before = instance.toSVG();
  for (const patch of [{ strokeWidth: -1 }, { strokeWidth: NaN }, { curve: 'invalid' }]) {
    let threw = false;
    try { instance.update(patch as Partial<LineChartOptions>); } catch { threw = true; }
    assert(threw && instance.toSVG() === before, 'invalid settings changed the chart');
  }
});
await test('line charts resize paths with their container', async () => {
  createLine(); const before = line().getAttribute('d'); fixture.style.width = '320px';
  await new Promise(resolve => setTimeout(resolve, 100));
  assert(line().getAttribute('d') !== before, 'line did not resize');
});
await test('line animation honors system preference and the animate option', () => {
  const instance = createLine({ animate: true });
  assert(line().getAnimations().length === (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1), 'motion preference ignored');
  instance.update({ animate: false }); assert(line().getAnimations().length === 0, 'animation setting ignored');
});
await test('bars and lines can coexist and be destroyed independently', () => {
  const instance = createLine(); const other = barChart(fixture, { data: [{ label: 'Bar', value: 20 }], animate: false });
  instance.destroy(); assert(fixture.querySelectorAll('[data-charto-line]').length === 0 && bars().length === 1, 'line destroy affected bars'); other.destroy();
});
await test('wide accessible tables do not cause horizontal overflow in narrow containers', () => {
  fixture.style.width = '260px';
  createLine({ data: [{ label: 'A long category label', value: [1, 2, 3, 4] }], series: [{ name: 'First long series name' }, { name: 'Second long series name' }, { name: 'Third long series name' }, { name: 'Fourth long series name' }] });
  assert(fixture.scrollWidth <= 260, 'accessible table causes horizontal overflow');
  assert(fixture.querySelectorAll('table th[scope=col]').length === 5, 'table semantics were lost');
});
await test('bar clicks deliver original data, raw values, indexes, and the native event once', () => {
  const data = [{ label: 'A', value: 1234.567 }, { label: 'B', value: -765.432 }];
  const calls: ChartClickEvent[] = [];
  create({ data, formatValue: () => 'formatted', onClick: event => calls.push(event) });
  const event = new MouseEvent('click', { bubbles: true, ctrlKey: true });
  bars()[1].dispatchEvent(event);
  const payload = calls[0];
  assert(calls.length === 1 && payload.datum === data[1] && payload.label === 'B' && payload.value === -765.432, 'wrong clicked datum or formatted value');
  assert(payload.dataIndex === 1 && payload.seriesIndex === 0 && payload.seriesName === 'Value' && payload.nativeEvent === event, 'missing click context');
  assert(bars()[1].getAttribute('role') === 'button' && getComputedStyle(bars()[1]).cursor === 'pointer' && getComputedStyle(bars()[1]).outlineStyle === 'none', 'click affordance or outline is incorrect');
  fixture.querySelector('svg')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert(calls.length === 1, 'chart background triggered a data click');
});
await test('grouped and stacked clicks identify the segment in both orientations', () => {
  const calls: ChartClickEvent[] = [];
  const instance = create({ data: [{ label: 'A', value: [10, -20] }, { label: 'B', value: [30, -40] }], series: [{ name: 'Online' }, { name: 'Retail' }], onClick: event => calls.push(event) });
  for (const orientation of ['vertical', 'horizontal'] as const) {
    for (const mode of ['grouped', 'stacked'] as const) {
      instance.update({ orientation, mode });
      bars()[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const payload = calls.at(-1)!;
      assert(payload.value === -40 && payload.label === 'B' && payload.dataIndex === 1 && payload.seriesIndex === 1 && payload.seriesName === 'Retail', 'segment context is incorrect');
    }
  }
  assert(calls.length === 4, 'click delivered more than once');
});
await test('line clicks work with both curves, hidden markers, and gaps in multiple series', () => {
  const calls: ChartClickEvent[] = [];
  const instance = createLine({ data: [{ label: 'A', value: [20, 10] }, { label: 'Missing', value: [] }, { label: 'C', value: [30, 40] }], onClick: event => calls.push(event) });
  for (const curve of ['linear', 'smooth'] as const) {
    for (const visible of [true, false]) {
      instance.update({ curve, points: visible });
      points()[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const payload = calls.at(-1)!;
      assert(payload.value === 40 && payload.label === 'C' && payload.dataIndex === 2 && payload.seriesIndex === 1 && payload.seriesName === 'Series 2', 'line click used mark order instead of data indexes');
    }
  }
  assert(calls.length === 4, 'line click delivered more than once');
});
await test('Enter and Space activate data once and prevent scrolling; arrows only navigate', () => {
  for (const factory of [create, createLine]) {
    const calls: ChartClickEvent[] = [];
    const instance = factory({ onClick: event => calls.push(event) });
    const mark = fixture.querySelector<SVGGraphicsElement>('[role=button]')!;
    mark.focus();
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      mark.dispatchEvent(event);
      assert(event.defaultPrevented && calls.at(-1)?.nativeEvent === event, 'keyboard activation lost event or did not prevent scrolling');
      mark.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true }));
    }
    mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert(calls.length === 2 && document.activeElement !== mark, 'keyboard activation repeated or arrow navigation broke');
    instance.destroy();
  }
});
await test('click callbacks can be replaced, removed, and safely update or destroy the chart', () => {
  const oldCalls: ChartClickEvent[] = [];
  const newCalls: ChartClickEvent[] = [];
  const instance = create({ onClick: event => oldCalls.push(event) });
  const stale = bars()[0];
  instance.update({ data: [{ label: 'New', value: 99 }], onClick: event => { newCalls.push(event); instance.update({ color: '#fa4768' }); } });
  stale.dispatchEvent(new MouseEvent('click'));
  bars()[0].dispatchEvent(new MouseEvent('click'));
  bars()[0].dispatchEvent(new MouseEvent('click'));
  assert(oldCalls.length === 0 && newCalls.length === 2 && newCalls[0].label === 'New' && newCalls[0].value === 99, 'callback replacement used stale data or handlers');
  instance.update({ onClick: undefined });
  bars()[0].dispatchEvent(new MouseEvent('click'));
  assert(newCalls.length === 2 && bars()[0].getAttribute('role') === 'img' && getComputedStyle(bars()[0]).cursor === 'default', 'callback removal left interaction enabled');
  instance.update({ onClick: event => { newCalls.push(event); instance.destroy(); } });
  const last = bars()[0];
  last.dispatchEvent(new MouseEvent('click'));
  last.dispatchEvent(new MouseEvent('click'));
  assert(newCalls.length === 3 && fixture.childElementCount === 0, 'destroyed chart still handles clicks');
});
await test('invalid callbacks leave the existing chart intact', () => {
  const instance = create();
  const before = instance.toSVG();
  let threw = false;
  try { instance.update({ onClick: 'invalid' } as unknown as Partial<BarChartOptions>); } catch { threw = true; }
  assert(threw && instance.toSVG() === before, 'invalid callback changed the chart');
});
await test('clickable SVG exports remain static images without interactive roles', () => {
  const instance = create({ onClick: () => {} });
  const xml = new DOMParser().parseFromString(instance.toSVG(), 'image/svg+xml');
  assert(!xml.querySelector('[role=button], [tabindex], [onclick], script') && xml.querySelectorAll('[data-charto-bar]').length === 2, 'export contains interactive state or lost bars');
});
await test('line fill exports a visible gradient below the curve and toggles cleanly', async () => {
  const instance = createLine({ data: [{ label: 'A', value: 70 }, { label: 'B', value: 70 }], fill: true, min: 0, max: 100, grid: false, points: false });
  const isWhite = await rasterize(instance);
  assert(!isWhite(320, 201) && isWhite(320, 60), 'area is missing or fills above the line');
  assert(fixture.querySelector('[data-charto-area]')?.getAttribute('pointer-events') === 'none', 'area intercepts clicks');
  instance.update({ fill: false });
  assert(!fixture.querySelector('[data-charto-area], linearGradient'), 'disabled fill left old graphics');
  assert((await rasterize(instance))(320, 201), 'disabled area still exported');
});
await test('filled lines close at zero for negative data and preserve gaps and series colors', async () => {
  const instance = createLine({ data: [{ label: 'A', value: -70 }, { label: 'B', value: -70 }], fill: true, min: -100, max: 100, grid: false });
  const isWhite = await rasterize(instance);
  assert(!isWhite(320, 201) && isWhite(320, 270), 'negative fill did not close at zero');
  instance.update({ data: [{ label: 'A', value: [20, 10] }, { label: 'B', value: [30, 20] }, { label: 'Gap', value: [] }, { label: 'D', value: [40, 30] }, { label: 'E', value: [50, 40] }], series: [{ name: 'One', color: '#fa4768' }, { name: 'Two', color: '#9066f4' }] });
  const areas = [...fixture.querySelectorAll('[data-charto-area]')];
  assert(areas.length === 2 && areas.every(area => (area.getAttribute('d')!.match(/M/g) ?? []).length === 2), 'fill bridges missing data');
  assert(fixture.querySelectorAll('linearGradient stop')[0].getAttribute('stop-color') === '#fa4768', 'series fill color incorrect');
  instance.update({ data: [{ label: 'Only', value: 10 }] });
  assert(!fixture.querySelector('[data-charto-area]'), 'one point invented an area');
});
await test('fill gradients have independent IDs across chart instances and animate accessibly', () => {
  const instance = createLine({ fill: true, animate: true });
  const other = lineChart(fixture, { data: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }], fill: true, animate: false });
  try {
    const gradients = [...fixture.querySelectorAll('linearGradient')];
    assert(gradients.length === 2 && gradients[0].id !== gradients[1].id, 'gradient IDs collide');
    const group = fixture.querySelector('[data-charto-fills]')!;
    assert(group.getAnimations().length === (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1), 'fill animation ignores motion preference');
    instance.update({ animate: false });
    assert(fixture.querySelector('[data-charto-fills]')!.getAnimations().length === 0, 'fill animation remains enabled');
  } finally { other.destroy(); }
});
await test('compact bars and lines fit small containers without axes and keep clicks and data tables', () => {
  for (const factory of [create, createLine]) {
    fixture.style.width = '96px';
    let clicked = false;
    const instance = factory({ compact: true, height: undefined, values: true, onClick: () => { clicked = true; } });
    const svg = fixture.querySelector('svg')!;
    assert(svg.getAttribute('height') === '80' && svg.getAttribute('viewBox') === '0 0 96 80', 'compact defaults do not fit');
    assert(!svg.querySelector('text, line') && fixture.querySelector('table')?.textContent?.includes('40'), 'compact axes remain or data was removed');
    fixture.querySelector('[role=button]')!.dispatchEvent(new MouseEvent('click'));
    assert(clicked && fixture.scrollWidth <= 96, 'compact interaction or layout failed');
    instance.update({ compact: false, values: false });
    assert(fixture.querySelector('svg')?.getAttribute('height') === '320' && fixture.querySelector('svg text'), 'normal layout did not return');
    instance.update({ compact: true, data: [] });
    assert(!fixture.querySelector('svg text') && fixture.scrollWidth <= 96, 'empty mini chart overflows with text');
    instance.destroy();
  }
});
await test('tooltips can be disabled or formatted as plain text without changing click behavior', () => {
  for (const factory of [create, createLine]) {
    let clicks = 0;
    const instance = factory({ tooltip: false, onClick: () => { clicks++; } });
    let mark = fixture.querySelector<SVGGraphicsElement>('[role=button]')!;
    mark.focus();
    mark.dispatchEvent(new PointerEvent('pointerenter'));
    mark.dispatchEvent(new MouseEvent('click'));
    assert(fixture.querySelector<HTMLElement>('[role=tooltip]')!.hidden && clicks === 1, 'disabled tooltip affected click or is visible');
    instance.update({ tooltip: point => `<b>${point.label}</b> · ${point.value} / ${point.seriesIndex}` });
    mark = fixture.querySelector<SVGGraphicsElement>('[role=button]')!;
    mark.focus();
    const tooltip = fixture.querySelector<HTMLElement>('[role=tooltip]')!;
    assert(tooltip.textContent === '<b>A</b> · 20 / 0' && !tooltip.querySelector('b'), 'custom tooltip interpreted HTML or lost context');
    instance.update({ tooltip: () => '' });
    fixture.querySelector<SVGGraphicsElement>('[role=button]')!.focus();
    assert(tooltip.hidden, 'empty tooltip text produced a box');
    instance.update({ tooltip: undefined });
    fixture.querySelector<SVGGraphicsElement>('[role=button]')!.focus();
    assert(tooltip.textContent === 'A\n20', 'default tooltip did not return');
    instance.destroy();
  }
});
await test('fixed scales clip bars at the visible bounds in both orientations', () => {
  const instance = create({ data: [{ label: 'Below', value: 20 }, { label: 'Inside', value: 70 }, { label: 'Above', value: 140 }], min: 50, max: 100 });
  for (const orientation of ['vertical', 'horizontal'] as const) {
    instance.update({ orientation });
    assert(bars().length === 2, 'fully clipped bar remains');
    for (const bar of bars()) {
      const start = Number(bar.getAttribute(orientation === 'vertical' ? 'y' : 'x'));
      const length = Number(bar.getAttribute(orientation === 'vertical' ? 'height' : 'width'));
      assert(start >= 24 && start + length <= (orientation === 'vertical' ? 284 : 616), 'bar extends beyond plot');
    }
  }
  instance.update({ mode: 'stacked', orientation: 'vertical', data: [{ label: 'A', value: [60, 80] }], radius: 8 });
  assert(bars().length === 2 && Number(bars()[1].getAttribute('y')) === 24, 'stack was not clipped at maximum');
});
await test('fixed line scales clip paths and omit out-of-range point targets while preserving table data', () => {
  const instance = createLine({ data: [{ label: 'Low', value: -100 }, { label: 'Middle', value: 50 }, { label: 'High', value: 200 }], min: 0, max: 100, fill: true });
  assert(points().length === 1 && points()[0].getAttribute('aria-label') === 'Middle: 50', 'out-of-range points remain interactive');
  assert(line().parentElement?.getAttribute('clip-path') && fixture.querySelector('table')?.textContent?.includes('200'), 'line is unclipped or raw data lost');
  instance.update({ min: undefined, max: undefined });
  assert(points().length === 3 && !line().parentElement?.getAttribute('clip-path'), 'automatic scale did not return');
  instance.update({ min: 0, max: 1e-300, data: [{ label: 'A', value: -1e100 }, { label: 'B', value: 1e100 }] });
  assert(!/NaN|Infinity/.test(instance.toSVG()), 'extreme out-of-range values produced invalid coordinates');
});
await test('invalid scale and tooltip updates preserve the previous chart', () => {
  const instance = createLine({ fill: true });
  const before = instance.toSVG();
  for (const patch of [{ min: 100, max: 0 }, { min: NaN }, { max: Infinity }, { tooltip: 'invalid' }]) {
    let threw = false;
    try { instance.update(patch as Partial<LineChartOptions>); } catch { threw = true; }
    assert(threw && instance.toSVG() === before, 'invalid options replaced the chart');
  }
});
document.querySelector('#summary')!.textContent = `${passed} passed, ${failed} failed`;
document.title = `Charto: ${passed} passed, ${failed} failed`;
