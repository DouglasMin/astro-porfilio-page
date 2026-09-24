import { kstDate, kstHour, kstWeekday, type DeviceType, type EventType, type RefCategory } from './event.ts';

/** One enriched event as stored in DynamoDB. */
export interface StoredEvent {
  type: EventType;
  ts: number;
  vid: string;
  sid: string;
  path: string;
  title?: string;
  refHost?: string;
  refCategory?: RefCategory;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  device?: DeviceType;
  os?: string;
  browser?: string;
  screen?: string;
  lang?: string;
  country?: string;
  region?: string;
  city?: string;
  newVisitor?: boolean;
  duration?: number;
  scroll?: number;
  href?: string;
}

export interface Row {
  label: string;
  value: number;
}

export interface PageRow {
  path: string;
  title: string;
  pageviews: number;
  visitors: number;
  avgTimeMs: number;
  avgScroll: number;
}

export interface CampaignRow {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
}

export interface Dashboard {
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
  daily: { date: string; visitors: number; pageviews: number }[];
  sourceCategories: { label: RefCategory; sessions: number }[];
  referrers: Row[];
  campaigns: CampaignRow[];
  pages: PageRow[];
  entryPages: Row[];
  exitPages: Row[];
  devices: Row[];
  os: Row[];
  browsers: Row[];
  screens: Row[];
  languages: Row[];
  countries: Row[];
  cities: Row[];
  /** [weekday 0-6 (Sun first)][hour 0-23] pageviews, KST */
  heatmap: number[][];
  outbound: Row[];
  scrollDepth: Row[];
}

const TOP_N = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function byValueThenLabel(a: Row, b: Row): number {
  return b.value - a.value || a.label.localeCompare(b.label);
}

/** Increments a counter map without mutating the caller's view of it. */
function bump(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function addTo(map: Map<string, Set<string>>, key: string, member: string): void {
  const set = map.get(key) ?? new Set<string>();
  set.add(member);
  map.set(key, set);
}

function toRows(map: Map<string, number>): Row[] {
  return [...map].map(([label, value]) => ({ label, value })).sort(byValueThenLabel).slice(0, TOP_N);
}

/** Unique visitors per label for a given pageview attribute. */
function visitorBreakdown(pageviews: StoredEvent[], pick: (event: StoredEvent) => string | undefined): Row[] {
  const visitorsByLabel = new Map<string, Set<string>>();
  for (const event of pageviews) addTo(visitorsByLabel, pick(event) ?? 'unknown', event.vid);
  return toRows(new Map([...visitorsByLabel].map(([label, set]) => [label, set.size])));
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= Date.parse(`${to}T00:00:00Z`); ms += DAY_MS) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

function scrollBucket(scroll: number): string {
  if (scroll <= 25) return '0-25%';
  if (scroll <= 50) return '26-50%';
  if (scroll <= 75) return '51-75%';
  return '76-100%';
}

export function aggregate(events: StoredEvent[], range: { from: string; to: string }): Dashboard {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const pageviews = sorted.filter((event) => event.type === 'pv');
  const leaves = sorted.filter((event) => event.type === 'leave');
  const outbound = sorted.filter((event) => event.type === 'out');

  const sessions = new Map<string, StoredEvent[]>();
  for (const event of pageviews) sessions.set(event.sid, [...(sessions.get(event.sid) ?? []), event]);

  const sessionTime = new Map<string, number>();
  for (const event of leaves) bump(sessionTime, event.sid, event.duration ?? 0);

  // Summary
  const visitors = new Set(pageviews.map((event) => event.vid));
  const newVisitors = new Set(pageviews.filter((event) => event.newVisitor).map((event) => event.vid));
  const sessionList = [...sessions.values()];
  const bounces = sessionList.filter((list) => list.length === 1).length;

  // Daily
  const dailyVisitors = new Map<string, Set<string>>();
  const dailyViews = new Map<string, number>();
  for (const event of pageviews) {
    const date = kstDate(event.ts);
    addTo(dailyVisitors, date, event.vid);
    bump(dailyViews, date);
  }

  // Sources, attributed to the first pageview of each session
  const categories = new Map<string, number>();
  const referrers = new Map<string, number>();
  const campaigns = new Map<string, CampaignRow>();
  const entryPages = new Map<string, number>();
  const exitPages = new Map<string, number>();
  for (const list of sessionList) {
    const entry = list[0];
    const exit = list[list.length - 1];
    if (!entry || !exit) continue;
    bump(entryPages, entry.path);
    bump(exitPages, exit.path);

    const category = entry.refCategory === 'internal' ? 'direct' : (entry.refCategory ?? 'direct');
    bump(categories, category);
    if (category !== 'direct' && entry.refHost) bump(referrers, entry.refHost);

    if (entry.utmSource || entry.utmMedium || entry.utmCampaign) {
      const key = [entry.utmSource, entry.utmMedium, entry.utmCampaign].join('|');
      const current = campaigns.get(key);
      campaigns.set(key, {
        source: entry.utmSource ?? '',
        medium: entry.utmMedium ?? '',
        campaign: entry.utmCampaign ?? '',
        sessions: (current?.sessions ?? 0) + 1,
      });
    }
  }

  // Pages
  const pageStats = new Map<string, { title: string; views: number; visitors: Set<string>; times: number[]; scrolls: number[] }>();
  const pageFor = (path: string) =>
    pageStats.get(path) ?? { title: '', views: 0, visitors: new Set<string>(), times: [], scrolls: [] };
  for (const event of pageviews) {
    const stats = pageFor(event.path);
    stats.views += 1;
    stats.visitors.add(event.vid);
    if (event.title) stats.title = event.title;
    pageStats.set(event.path, stats);
  }
  for (const event of leaves) {
    const stats = pageFor(event.path);
    stats.times.push(event.duration ?? 0);
    stats.scrolls.push(event.scroll ?? 0);
    pageStats.set(event.path, stats);
  }

  // Heatmap
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const event of pageviews) {
    const row = heatmap[kstWeekday(event.ts)];
    if (row) row[kstHour(event.ts)] = (row[kstHour(event.ts)] ?? 0) + 1;
  }

  const scrollCounts = new Map(['0-25%', '26-50%', '51-75%', '76-100%'].map((label) => [label, 0]));
  for (const event of leaves) bump(scrollCounts, scrollBucket(event.scroll ?? 0));

  const outboundCounts = new Map<string, number>();
  for (const event of outbound) if (event.href) bump(outboundCounts, event.href);

  return {
    range,
    summary: {
      visitors: visitors.size,
      newVisitors: newVisitors.size,
      pageviews: pageviews.length,
      sessions: sessions.size,
      pagesPerSession: sessions.size ? pageviews.length / sessions.size : 0,
      bounceRate: sessions.size ? bounces / sessions.size : 0,
      avgSessionMs: average([...sessions.keys()].map((sid) => sessionTime.get(sid) ?? 0)),
      avgScroll: average(leaves.map((event) => event.scroll ?? 0)),
    },
    daily: datesBetween(range.from, range.to).map((date) => ({
      date,
      visitors: dailyVisitors.get(date)?.size ?? 0,
      pageviews: dailyViews.get(date) ?? 0,
    })),
    sourceCategories: [...categories]
      .map(([label, value]) => ({ label: label as RefCategory, sessions: value }))
      .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label)),
    referrers: toRows(referrers),
    campaigns: [...campaigns.values()].sort((a, b) => b.sessions - a.sessions).slice(0, TOP_N),
    pages: [...pageStats]
      .map(([path, stats]) => ({
        path,
        title: stats.title,
        pageviews: stats.views,
        visitors: stats.visitors.size,
        avgTimeMs: average(stats.times),
        avgScroll: average(stats.scrolls),
      }))
      .filter((row) => row.pageviews > 0)
      .sort((a, b) => b.pageviews - a.pageviews || a.path.localeCompare(b.path))
      .slice(0, TOP_N),
    entryPages: toRows(entryPages),
    exitPages: toRows(exitPages),
    devices: visitorBreakdown(pageviews, (event) => event.device),
    os: visitorBreakdown(pageviews, (event) => event.os),
    browsers: visitorBreakdown(pageviews, (event) => event.browser),
    screens: visitorBreakdown(pageviews, (event) => event.screen),
    languages: visitorBreakdown(pageviews, (event) => event.lang),
    countries: visitorBreakdown(pageviews, (event) => event.country),
    cities: visitorBreakdown(pageviews, (event) => (event.city ? `${event.city}, ${event.country ?? '?'}` : undefined)),
    heatmap,
    outbound: toRows(outboundCounts),
    scrollDepth: [...scrollCounts].map(([label, value]) => ({ label, value })),
  };
}

/** Distinct visitors with any event in the trailing window. */
export function countLiveVisitors(events: StoredEvent[], nowMs: number, windowMs: number): number {
  return new Set(events.filter((event) => event.ts > nowMs - windowMs && event.ts <= nowMs).map((event) => event.vid)).size;
}
