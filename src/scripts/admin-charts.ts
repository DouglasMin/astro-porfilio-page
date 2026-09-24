/**
 * Hand-built SVG charts for the admin dashboard: a two-series trend line
 * (visitors emphasised, pageviews as grey context) and a weekday × hour heatmap.
 * All text is set with textContent; nothing from the API is parsed as HTML.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface DailyPoint {
  date: string;
  visitors: number;
  pageviews: number;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate * 4 >= value) ?? magnitude * 10;
  return step * 4;
}

const format = (value: number) => value.toLocaleString('ko-KR');
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** Shared tooltip that follows the pointer inside a chart container. */
function createTooltip(container: HTMLElement): { show: (x: number, y: number, lines: [string, string][]) => void; hide: () => void } {
  const tip = document.createElement('div');
  tip.className = 'chart-tooltip';
  tip.hidden = true;
  container.append(tip);
  return {
    show(x, y, lines) {
      tip.replaceChildren(
        ...lines.map(([label, value], index) => {
          const row = document.createElement('div');
          row.className = index === 0 ? 'chart-tooltip-title' : 'chart-tooltip-row';
          const name = document.createElement('span');
          name.textContent = label;
          row.append(name);
          if (value) {
            const amount = document.createElement('strong');
            amount.textContent = value;
            row.append(amount);
          }
          return row;
        }),
      );
      tip.hidden = false;
      const maxX = container.clientWidth - tip.offsetWidth - 4;
      tip.style.transform = `translate(${Math.max(4, Math.min(x + 12, maxX))}px, ${Math.max(0, y - tip.offsetHeight - 12)}px)`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}

export function renderTrendChart(container: HTMLElement, points: DailyPoint[]): void {
  container.replaceChildren();
  const width = Math.max(container.clientWidth, 280);
  const height = 240;
  const margin = { top: 16, right: 12, bottom: 28, left: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const max = niceMax(Math.max(1, ...points.map((point) => Math.max(point.visitors, point.pageviews))));
  const x = (index: number) => margin.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => margin.top + plotHeight - (value / max) * plotHeight;

  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': '일별 방문자와 조회수 추이' });

  for (let step = 0; step <= 4; step += 1) {
    const value = (max / 4) * step;
    root.append(svg('line', { x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value), class: 'chart-grid' }));
    const label = svg('text', { x: margin.left - 8, y: y(value) + 4, class: 'chart-axis', 'text-anchor': 'end' });
    label.textContent = format(value);
    root.append(label);
  }

  const tickEvery = Math.max(1, Math.ceil(points.length / 7));
  points.forEach((point, index) => {
    if (index % tickEvery !== 0 && index !== points.length - 1) return;
    const label = svg('text', { x: x(index), y: height - 8, class: 'chart-axis', 'text-anchor': 'middle' });
    label.textContent = shortDate(point.date);
    root.append(label);
  });

  const linePath = (pick: (point: DailyPoint) => number) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`).join(' ');

  // Context series first so the emphasised one draws on top
  root.append(svg('path', { d: linePath((point) => point.pageviews), class: 'chart-line chart-line-context' }));
  root.append(svg('path', { d: linePath((point) => point.visitors), class: 'chart-line chart-line-primary' }));

  const crosshair = svg('line', { y1: margin.top, y2: margin.top + plotHeight, class: 'chart-crosshair', visibility: 'hidden' });
  const contextDot = svg('circle', { r: 4, class: 'chart-dot chart-dot-context', visibility: 'hidden' });
  const primaryDot = svg('circle', { r: 4.5, class: 'chart-dot chart-dot-primary', visibility: 'hidden' });
  root.append(crosshair, contextDot, primaryDot);

  // Transparent hit area wider than the lines themselves
  const hit = svg('rect', { x: margin.left, y: margin.top, width: plotWidth, height: plotHeight, fill: 'transparent' });
  root.append(hit);
  container.append(root);

  const tooltip = createTooltip(container);
  const setVisible = (visible: boolean) => {
    for (const element of [crosshair, contextDot, primaryDot]) element.setAttribute('visibility', visible ? 'visible' : 'hidden');
    if (!visible) tooltip.hide();
  };

  hit.addEventListener('pointermove', (event) => {
    const bounds = root.getBoundingClientRect();
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width;
    const index = points.length <= 1 ? 0 : Math.round(((relativeX - margin.left) / plotWidth) * (points.length - 1));
    const point = points[Math.max(0, Math.min(points.length - 1, index))];
    if (!point) return;
    const px = x(points.indexOf(point));
    crosshair.setAttribute('x1', String(px));
    crosshair.setAttribute('x2', String(px));
    primaryDot.setAttribute('cx', String(px));
    primaryDot.setAttribute('cy', String(y(point.visitors)));
    contextDot.setAttribute('cx', String(px));
    contextDot.setAttribute('cy', String(y(point.pageviews)));
    setVisible(true);
    tooltip.show((px / width) * bounds.width, (y(point.visitors) / height) * bounds.height, [
      [point.date, ''],
      ['방문자', `${format(point.visitors)}명`],
      ['조회수', `${format(point.pageviews)}회`],
    ]);
  });
  hit.addEventListener('pointerleave', () => setVisible(false));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// Korean calendars start the week on Monday
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function renderHeatmap(container: HTMLElement, heatmap: number[][]): void {
  container.replaceChildren();
  const max = Math.max(1, ...heatmap.flat());

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', '요일·시간대별 조회수 (한국 시간)');

  const corner = document.createElement('span');
  grid.append(corner);
  for (let hour = 0; hour < 24; hour += 1) {
    const label = document.createElement('span');
    label.className = 'heatmap-hour';
    label.textContent = hour % 3 === 0 ? String(hour) : '';
    grid.append(label);
  }

  const tooltip = createTooltip(container);

  for (const day of WEEKDAY_ORDER) {
    const label = document.createElement('span');
    label.className = 'heatmap-day';
    label.textContent = WEEKDAYS[day] ?? '';
    grid.append(label);

    for (let hour = 0; hour < 24; hour += 1) {
      const value = heatmap[day]?.[hour] ?? 0;
      const cell = document.createElement('span');
      cell.className = 'heatmap-cell';
      // One hue, more is darker; a small floor keeps non-zero hours visible
      const strength = value === 0 ? 0 : Math.round(12 + (value / max) * 88);
      cell.style.setProperty('--strength', `${strength}%`);
      cell.addEventListener('pointerenter', () => {
        const bounds = container.getBoundingClientRect();
        const cellBounds = cell.getBoundingClientRect();
        tooltip.show(cellBounds.left - bounds.left, cellBounds.top - bounds.top, [
          [`${WEEKDAYS[day]}요일 ${hour}시`, ''],
          ['조회수', `${format(value)}회`],
        ]);
      });
      cell.addEventListener('pointerleave', () => tooltip.hide());
      grid.append(cell);
    }
  }

  container.append(grid);
}
