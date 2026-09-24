/**
 * /admin: token login, range selection and rendering of the analytics dashboard.
 * Everything from the API is attacker-influenced (referrers, titles, URLs),
 * so the DOM is built with textContent only.
 */
import { renderHeatmap, renderTrendChart, type DailyPoint } from './admin-charts';
import { IGNORE_KEY } from './analytics';

const ENDPOINT = import.meta.env.PUBLIC_ANALYTICS_URL as string | undefined;
const TOKEN_KEY = 'a_admin_token';
const DAY_MS = 24 * 60 * 60 * 1000;

interface Row {
  label: string;
  value: number;
}

interface Dashboard {
  range: { from: string; to: string };
  summary: {
    visitors: number;
    newVisitors: number;
    pageviews: number;
    sessions: number;
    pagesPerSession: number;
    bounceRate: number;
    avgSessionMs: number;
    avgScroll: number;
  };
  daily: DailyPoint[];
  sourceCategories: { label: string; sessions: number }[];
  referrers: Row[];
  campaigns: { source: string; medium: string; campaign: string; sessions: number }[];
  pages: { path: string; title: string; pageviews: number; visitors: number; avgTimeMs: number; avgScroll: number }[];
  entryPages: Row[];
  exitPages: Row[];
  devices: Row[];
  os: Row[];
  browsers: Row[];
  screens: Row[];
  languages: Row[];
  countries: Row[];
  cities: Row[];
  heatmap: number[][];
  outbound: Row[];
  scrollDepth: Row[];
  live: number;
  counters: { today: number; total: number };
  generatedAt: string;
}

class UnauthorizedError extends Error {}

let pageController: AbortController | undefined;

const SOURCE_LABELS: Record<string, string> = { direct: '직접 방문', search: '검색', social: 'SNS', other: '다른 사이트', internal: '사이트 내부' };
const DEVICE_LABELS: Record<string, string> = { desktop: 'PC', mobile: '모바일', tablet: '태블릿' };

const format = (value: number) => value.toLocaleString('ko-KR');
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function fetchDashboard(token: string, from: string, to: string): Promise<Dashboard> {
  const response = await fetch(`${ENDPOINT}/stats?${new URLSearchParams({ from, to })}`, {
    headers: { 'x-admin-token': token },
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    const message = typeof body === 'object' && body && 'error' in body ? String(body.error) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return (await response.json()) as Dashboard;
}

/** Horizontal bar list: label, a proportional bar, and the value in text ink. */
function barList(rows: Row[], options: { labelFor?: (label: string) => string; unit?: string; link?: boolean } = {}): HTMLElement {
  if (rows.length === 0) return el('p', 'empty-state', '아직 데이터가 없어요.');
  const max = Math.max(...rows.map((row) => row.value));
  const list = el('ol', 'bar-list');
  for (const row of rows.slice(0, 10)) {
    const item = el('li', 'bar-row');
    const label = options.labelFor?.(row.label) ?? row.label;
    const name = options.link && /^https?:\/\//.test(row.label) ? el('a', 'bar-label', label) : el('span', 'bar-label', label);
    if (name instanceof HTMLAnchorElement) {
      name.href = row.label;
      name.target = '_blank';
      name.rel = 'noopener noreferrer';
    }
    name.title = row.label;
    const track = el('span', 'bar-track');
    const fill = el('span', 'bar-fill');
    fill.style.width = `${Math.max(2, (row.value / max) * 100)}%`;
    track.append(fill);
    item.append(name, track, el('span', 'bar-value', `${format(row.value)}${options.unit ?? ''}`));
    list.append(item);
  }
  return list;
}

type Cell = string | number | Node;

function table(headers: string[], rows: Cell[][], numericFrom = 1): HTMLElement {
  if (rows.length === 0) return el('p', 'empty-state', '아직 데이터가 없어요.');
  const wrapper = el('div', 'table-scroll');
  const tableEl = el('table', 'data-table');
  const head = el('tr');
  headers.forEach((header, index) => head.append(el('th', index >= numericFrom ? 'num' : undefined, header)));
  tableEl.append(el('thead'));
  tableEl.tHead?.append(head);
  const body = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    row.forEach((cell, index) => {
      const td = el('td', index >= numericFrom ? 'num' : undefined);
      td.append(cell instanceof Node ? cell : typeof cell === 'number' ? format(cell) : cell);
      tr.append(td);
    });
    body.append(tr);
  }
  tableEl.append(body);
  wrapper.append(tableEl);
  return wrapper;
}

function panel(title: string, content: HTMLElement, note?: string): HTMLElement {
  const section = el('section', 'panel');
  const header = el('header', 'panel-head');
  header.append(el('h2', undefined, title));
  if (note) header.append(el('p', 'panel-note', note));
  section.append(header, content);
  return section;
}

/** Page titles all end with the site name; drop it so the table reads by content. */
function pageCell(title: string, path: string): HTMLElement {
  const cell = el('div', 'page-cell');
  const cleanTitle = title.replace(/\s+-\s+[^-]*$/, '').trim();
  cell.append(el('span', 'page-title', cleanTitle || path));
  if (cleanTitle) cell.append(el('span', 'page-path', path));
  return cell;
}

function kpi(label: string, value: string, detail?: string): HTMLElement {
  const tile = el('div', 'kpi');
  tile.append(el('p', 'kpi-label', label), el('p', 'kpi-value', value));
  if (detail) tile.append(el('p', 'kpi-detail', detail));
  return tile;
}

function renderDashboard(root: HTMLElement, data: Dashboard): void {
  const { summary } = data;

  const status = el('div', 'live-strip');
  const liveDot = el('span', 'live-dot');
  liveDot.setAttribute('aria-hidden', 'true');
  status.append(
    liveDot,
    el('span', undefined, `지금 ${format(data.live)}명이 보고 있어요`),
    el('span', 'live-counters', `오늘 ${format(data.counters.today)}명 · 전체 ${format(data.counters.total)}명`),
  );

  const kpis = el('div', 'kpi-row');
  kpis.append(
    kpi('방문자', format(summary.visitors), `신규 ${percent(summary.visitors ? summary.newVisitors / summary.visitors : 0)}`),
    kpi('조회수', format(summary.pageviews), `방문당 ${summary.pagesPerSession.toFixed(1)}페이지`),
    kpi('방문 횟수', format(summary.sessions)),
    kpi('평균 체류', duration(summary.avgSessionMs)),
    kpi('이탈률', percent(summary.bounceRate), '한 페이지만 보고 떠남'),
    kpi('평균 스크롤', `${Math.round(summary.avgScroll)}%`),
  );

  const trend = el('div', 'chart');
  const legend = el('div', 'chart-legend');
  const legendItem = (className: string, label: string) => {
    const item = el('span', 'legend-item');
    item.append(el('span', `legend-swatch ${className}`), el('span', undefined, label));
    return item;
  };
  legend.append(legendItem('swatch-primary', '방문자'), legendItem('swatch-context', '조회수'));
  const trendWrap = el('div');
  const trendTable = el('details', 'table-toggle');
  trendTable.append(el('summary', undefined, '표로 보기'), table(['날짜', '방문자', '조회수'], data.daily.map((d) => [d.date, d.visitors, d.pageviews])));
  trendWrap.append(legend, trend, trendTable);

  const heatmap = el('div', 'heatmap');

  const sources = barList(
    data.sourceCategories.map((row) => ({ label: row.label, value: row.sessions })),
    { labelFor: (label) => SOURCE_LABELS[label] ?? label, unit: '회' },
  );

  const grid = el('div', 'panel-grid');
  grid.append(
    panel('유입 경로', sources, '방문이 시작된 곳 기준'),
    panel('유입 사이트', barList(data.referrers, { unit: '회' })),
    panel(
      '캠페인 (UTM)',
      table(['소스', '매체', '캠페인', '방문'], data.campaigns.map((row) => [row.source || '-', row.medium || '-', row.campaign || '-', row.sessions]), 3),
      '링크에 ?utm_source=… 를 붙이면 여기 잡혀요',
    ),
    panel('외부 링크 클릭', barList(data.outbound, { unit: '회', link: true })),
    panel('첫 페이지', barList(data.entryPages, { unit: '회' })),
    panel('마지막 페이지', barList(data.exitPages, { unit: '회' })),
    panel('기기', barList(data.devices, { labelFor: (label) => DEVICE_LABELS[label] ?? label, unit: '명' })),
    panel('운영체제', barList(data.os, { unit: '명' })),
    panel('브라우저', barList(data.browsers, { unit: '명' })),
    panel('화면 너비', barList(data.screens, { unit: '명' })),
    panel('국가', barList(data.countries, { unit: '명' })),
    panel('도시', barList(data.cities, { unit: '명' })),
    panel('언어', barList(data.languages, { unit: '명' })),
    panel('스크롤 깊이', barList(data.scrollDepth, { unit: '회' }), '페이지를 어디까지 읽었는지'),
  );

  const pages = panel(
    '페이지별',
    table(
      ['페이지', '조회수', '방문자', '평균 체류', '평균 스크롤'],
      data.pages.map((row) => [pageCell(row.title, row.path), row.pageviews, row.visitors, duration(row.avgTimeMs), `${Math.round(row.avgScroll)}%`]),
    ),
  );

  root.replaceChildren(
    status,
    kpis,
    panel('일별 추이', trendWrap),
    pages,
    panel('요일·시간대', heatmap, '한국 시간 기준 조회수'),
    grid,
    el('p', 'generated-at', `${new Date(data.generatedAt).toLocaleString('ko-KR')} 기준`),
  );

  renderTrendChart(trend, data.daily);
  renderHeatmap(heatmap, data.heatmap);
}

export function initAdminDashboard(): void {
  const login = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const output = document.getElementById('dashboard-output');
  const message = document.getElementById('admin-message');
  const form = document.getElementById('login-form') as HTMLFormElement | null;
  const fromInput = document.getElementById('range-from') as HTMLInputElement | null;
  const toInput = document.getElementById('range-to') as HTMLInputElement | null;
  pageController?.abort();
  if (!login || !dashboard || !output || !message || !form || !fromInput || !toInput) return;
  pageController = new AbortController();
  const { signal } = pageController;

  const showMessage = (text: string) => {
    message.textContent = text;
    message.hidden = !text;
  };

  if (!ENDPOINT) {
    showMessage('PUBLIC_ANALYTICS_URL이 설정되지 않았어요. infra 스택을 배포한 뒤 .env에 추가하세요.');
    form.hidden = true;
    return;
  }

  let lastData: Dashboard | undefined;
  let token = readToken();

  const showLogin = (error?: string) => {
    login.hidden = false;
    dashboard.hidden = true;
    showMessage(error ?? '');
  };

  const load = async () => {
    if (!token) return showLogin();
    output.setAttribute('aria-busy', 'true');
    try {
      lastData = await fetchDashboard(token, fromInput.value, toInput.value);
      login.hidden = true;
      dashboard.hidden = false;
      showMessage('');
      renderDashboard(output, lastData);
    } catch (error: unknown) {
      if (error instanceof UnauthorizedError) {
        sessionStorage.removeItem(TOKEN_KEY);
        token = null;
        return showLogin('토큰이 맞지 않아요. 다시 입력하세요.');
      }
      showMessage(`불러오지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      output.removeAttribute('aria-busy');
    }
  };

  const setRange = (days: number) => {
    const today = kstToday();
    toInput.value = today;
    fromInput.value = shiftDate(today, -(days - 1));
    document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.range) === days));
    });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    token = String(data.get('token') ?? '').trim();
    if (!token) return;
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (data.get('exclude') === 'on') localStorage.setItem(IGNORE_KEY, '1');
    } catch {
      // Storage blocked: the token still works for this page view
    }
    form.reset();
    void load();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((button) => {
    button.addEventListener('click', () => {
      setRange(Number(button.dataset.range));
      void load();
    });
  });

  for (const input of [fromInput, toInput]) {
    input.addEventListener('change', () => {
      document.querySelectorAll('[data-range]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
      void load();
    });
  }

  document.getElementById('refresh-btn')?.addEventListener('click', () => void load());
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    token = null;
    showLogin();
  });

  // Charts are sized to their container, so redraw on resize
  let resizeTimer: number | undefined;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (lastData && !dashboard.hidden) renderDashboard(output, lastData);
      }, 150);
    },
    { signal },
  );

  setRange(7);
  void load();
}
