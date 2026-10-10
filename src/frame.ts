import { PAINT, svgElement, themeColors } from './svg.ts';
import type { Chart, ChartColors } from './types.js';

let chartSequence = 0;

/** What every chart type's options share. */
export interface FrameOptions {
  theme?: 'light' | 'dark';
  colors?: Partial<ChartColors>;
  animate?: boolean;
}

export interface MarkSpec {
  /** The screen-reader name. */
  label: string;
  /** Tooltip text; an empty string hides the tooltip. Asked on hover and focus. */
  tooltip(): string;
  /** Present: the mark is a button (click, Enter, Space). */
  activate?(nativeEvent: MouseEvent | KeyboardEvent): void;
  /** Hover and focus emphasis. Default: a brightness filter while hovered. */
  emphasize?(on: boolean): void;
}

export interface DrawContext<O> {
  readonly options: O;
  readonly chartId: string;
  /** The host's width, else the last drawn width, else 640. */
  readonly hostWidth: number;
  /** The SVG's parent: the wrapper, or a scroll box inside it for a chart that asks for one. */
  readonly stage: HTMLElement;
  readonly table: HTMLTableElement;
  /** Play an opening animation, unless motion is off for this render. */
  play(element: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions): void;
  /** Make an SVG element a keyboard and tooltip target, in the order the marks are added. */
  mark(element: SVGGraphicsElement, spec: MarkSpec): void;
}

export interface Drawing {
  svg: SVGSVGElement;
  /** The width the SVG was drawn at, written on an export. */
  width: number;
  /** How wide the tooltip may travel. Default: the drawn width. */
  view?: number;
  /** The host width a resize is measured against. Default: the drawn width. */
  track?: number;
}

export interface ChartType<O> {
  validate(options: O): void;
  defaults(input: O): O;
  draw(context: DrawContext<O>): Drawing;
  /** Strip what only the live chart needs from an export clone. */
  clean(clone: SVGSVGElement): void;
  /** Draw the SVG inside a scroll box of its own. */
  scroll?: boolean;
}

/** The parts every chart shares: tooltip, keyboard marks, data table, resize, export and teardown. */
export function createFrame<O extends FrameOptions>(target: string | HTMLElement, initial: O, type: ChartType<O>): Chart<O> {
  const host = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!host) throw new Error('Charto: target element was not found.');
  type.validate(initial);
  let settings = { ...initial };
  let options = type.defaults(initial);
  const chartId = `charto-${++chartSequence}`;
  let destroyed = false;
  let renderedWidth = 0;
  let trackedWidth = 0;
  let view = 0;
  let frame = 0;
  let animations: Animation[] = [];
  let svg: SVGSVGElement | undefined;
  const wrapper = document.createElement('div');
  wrapper.className = 'charto';
  wrapper.style.cssText = 'position:relative;width:100%;min-width:0;isolation:isolate';
  const stage = type.scroll ? document.createElement('div') : wrapper;
  const tooltip = document.createElement('div');
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  tooltip.style.cssText = 'position:absolute;z-index:2;pointer-events:none;padding:10px 13px;border-radius:8px;font:12px/1.55 ui-sans-serif,system-ui,sans-serif;box-shadow:0 6px 20px #0002;white-space:pre-line;max-width:calc(100% - 16px);overflow-wrap:anywhere;box-sizing:border-box';
  const table = document.createElement('table');
  const accessibleData = document.createElement('div');
  accessibleData.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
  accessibleData.append(table);
  if (stage !== wrapper) wrapper.append(stage);
  wrapper.append(tooltip, accessibleData);
  host.append(wrapper);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** A colour as the page resolves it, so `var(--token)` survives an export. */
  function resolveColor(value: string): string {
    if (!value.includes('var(')) return value;
    const probe = document.createElement('span');
    probe.style.color = value;
    wrapper.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved || value;
  }

  function stopAnimations(): void { animations.forEach(animation => animation.cancel()); animations = []; }
  function hideTooltip(): void { tooltip.hidden = true; }

  function render(animate: boolean): void {
    if (destroyed) return;
    stopAnimations();
    hideTooltip();
    const theme = themeColors(options);
    tooltip.style.background = theme.tooltip;
    tooltip.style.color = theme.tooltipText;
    const measured = host!.getBoundingClientRect().width;
    const moving = animate && !!options.animate && !motion.matches;
    const marks: SVGGraphicsElement[] = [];
    const context: DrawContext<O> = {
      options, chartId, stage, table,
      hostWidth: measured || renderedWidth || 640,
      play(element, keyframes, timing) {
        if (moving && typeof element.animate === 'function') animations.push(element.animate(keyframes, timing));
      },
      mark(mark, spec) {
        const { activate, emphasize } = spec;
        mark.setAttribute('tabindex', marks.length === 0 ? '0' : '-1');
        mark.setAttribute('role', activate ? 'button' : 'img');
        mark.setAttribute('aria-label', spec.label);
        mark.style.cursor = activate ? 'pointer' : 'default';
        const press = (nativeEvent: MouseEvent | KeyboardEvent): void => {
          // A mark of a chart that has since been redrawn or destroyed opens nothing.
          if (destroyed || mark.ownerSVGElement !== svg) return;
          activate?.(nativeEvent);
        };
        if (activate) mark.addEventListener('click', press);
        const showTooltip = (event?: PointerEvent): void => {
          const content = spec.tooltip();
          if (!content) { hideTooltip(); return; }
          tooltip.textContent = content;
          tooltip.hidden = false;
          const wrapperBounds = wrapper.getBoundingClientRect();
          const markBounds = mark.getBoundingClientRect();
          const mouseX = event ? event.clientX - wrapperBounds.left : markBounds.x + markBounds.width / 2 - wrapperBounds.x;
          const mouseY = event ? event.clientY - wrapperBounds.top : markBounds.y - wrapperBounds.y;
          tooltip.style.left = `${Math.max(8, Math.min(view - tooltip.offsetWidth - 8, mouseX - tooltip.offsetWidth / 2))}px`;
          tooltip.style.top = `${Math.max(0, mouseY - tooltip.offsetHeight - 12)}px`;
        };
        mark.addEventListener('pointerenter', event => { if (emphasize) emphasize(true); else mark.style.filter = 'brightness(1.08)'; showTooltip(event); });
        mark.addEventListener('pointermove', showTooltip);
        mark.addEventListener('pointerleave', () => { if (emphasize) emphasize(false); else mark.style.filter = ''; hideTooltip(); });
        mark.addEventListener('focus', () => { emphasize?.(true); showTooltip(); });
        mark.addEventListener('blur', () => { emphasize?.(false); hideTooltip(); });
        mark.addEventListener('keydown', event => {
          if (activate && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            if (!event.repeat) press(event);
            return;
          }
          if (event.key === 'Escape') { hideTooltip(); return; }
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const current = marks.indexOf(mark);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? marks.length - 1 : (current + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + marks.length) % marks.length;
          mark.setAttribute('tabindex', '-1');
          marks[next].setAttribute('tabindex', '0');
          marks[next].focus();
        });
        marks.push(mark);
      },
    };
    const drawing = type.draw(context);
    if (svg) svg.replaceWith(drawing.svg); else stage.prepend(drawing.svg);
    svg = drawing.svg;
    renderedWidth = drawing.width;
    trackedWidth = drawing.track ?? drawing.width;
    view = drawing.view ?? drawing.width;
  }

  const observer = new ResizeObserver(() => {
    if (Math.abs(host!.getBoundingClientRect().width - trackedWidth) < 1) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => render(false));
  });
  const onMotionChange = (): void => { if (motion.matches) stopAnimations(); };
  motion.addEventListener('change', onMotionChange);
  observer.observe(host);
  render(true);

  return {
    update(patch) {
      if (destroyed) return;
      const nextSettings = { ...settings, ...patch };
      const next = type.defaults(nextSettings);
      type.validate(next);
      options = next;
      settings = nextSettings;
      render(true);
    },
    replay() { render(true); },
    toSVG() {
      if (destroyed) throw new Error('Charto: this chart has been destroyed.');
      const clone = svg!.cloneNode(true) as SVGSVGElement;
      // Back to presentation attributes, with every CSS variable resolved: a saved
      // file has no stylesheet to look one up in.
      for (const node of [clone, ...clone.querySelectorAll<SVGElement>('*')]) {
        for (const property of PAINT) {
          const value = node.style.getPropertyValue(property);
          if (!value) continue;
          node.setAttribute(property, resolveColor(value));
          node.style.removeProperty(property);
        }
        if (!node.style.length) node.removeAttribute('style');
      }
      clone.setAttribute('width', String(renderedWidth));
      clone.setAttribute('role', 'img');
      type.clean(clone);
      const background = svgElement('rect', { width: '100%', height: '100%' });
      background.setAttribute('fill', resolveColor(themeColors(options).background));
      clone.prepend(background);
      return new XMLSerializer().serializeToString(clone);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopAnimations();
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener('change', onMotionChange);
      wrapper.remove();
    },
  };
}
