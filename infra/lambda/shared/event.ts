import Bowser from 'bowser';

export type EventType = 'pv' | 'leave' | 'out';
export type RefCategory = 'direct' | 'search' | 'social' | 'internal' | 'other';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/** What the browser tracker sends (already validated and trimmed). */
export interface CollectEvent {
  t: EventType;
  vid: string;
  sid: string;
  path: string;
  title?: string;
  ref?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
  sw?: number;
  lang?: string;
  nv?: boolean;
  dur?: number;
  scroll?: number;
  href?: string;
}

export interface ParsedUserAgent {
  device: DeviceType;
  os: string;
  browser: string;
}

const MAX_BODY_BYTES = 4096;
const MAX_PATH = 512;
const MAX_TITLE = 200;
const MAX_URL = 1024;
const MAX_SHORT = 100;
const MAX_DURATION_MS = 30 * 60 * 1000;
const ID_PATTERN = /^[a-z0-9-]{8,64}$/i;
const EVENT_TYPES: ReadonlySet<string> = new Set<EventType>(['pv', 'leave', 'out']);
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http|java\//i;

const SEARCH_HOSTS = ['google.', 'naver.com', 'daum.net', 'bing.com', 'duckduckgo.com', 'yahoo.', 'baidu.com', 'ecosia.org'];
const SOCIAL_HOSTS = [
  'linkedin.com', 'lnkd.in', 'facebook.com', 'instagram.com', 't.co', 'twitter.com', 'x.com',
  'threads.net', 'kakao.com', 'band.us', 'reddit.com', 'youtube.com', 'velog.io', 'disquiet.io',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function hasProtocol(value: string, allowed: readonly string[]): boolean {
  try {
    return allowed.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const isHttpUrl = (value: string) => hasProtocol(value, ['http:', 'https:']);

function parseUtm(value: unknown): CollectEvent['utm'] {
  if (!isRecord(value)) return undefined;
  const utm = {
    source: optionalString(value.source, MAX_SHORT),
    medium: optionalString(value.medium, MAX_SHORT),
    campaign: optionalString(value.campaign, MAX_SHORT),
  };
  return utm.source || utm.medium || utm.campaign ? utm : undefined;
}

/** Validates an untrusted beacon body. Returns null for anything we should not store. */
export function parseCollectPayload(body: string): CollectEvent | null {
  if (body.length > MAX_BODY_BYTES) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;

  const { t, vid, sid, path } = raw;
  if (typeof t !== 'string' || !EVENT_TYPES.has(t)) return null;
  if (typeof vid !== 'string' || !ID_PATTERN.test(vid)) return null;
  if (typeof sid !== 'string' || !ID_PATTERN.test(sid)) return null;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.length > MAX_PATH) return null;

  const base = { t: t as EventType, vid, sid, path };

  if (t === 'pv') {
    const ref = optionalString(raw.ref, MAX_URL);
    const sw = optionalNumber(raw.sw);
    return {
      ...base,
      title: optionalString(raw.title, MAX_TITLE),
      ref: ref && isHttpUrl(ref) ? ref : undefined,
      utm: parseUtm(raw.utm),
      sw: sw !== undefined && sw > 0 && sw < 20000 ? Math.round(sw) : undefined,
      lang: optionalString(raw.lang, 20),
      nv: raw.nv === true,
    };
  }

  if (t === 'leave') {
    const dur = optionalNumber(raw.dur);
    const scroll = optionalNumber(raw.scroll);
    if (dur === undefined || dur < 0 || scroll === undefined || scroll < 0) return null;
    return {
      ...base,
      dur: Math.min(Math.round(dur), MAX_DURATION_MS),
      scroll: Math.min(Math.round(scroll), 100),
    };
  }

  const href = optionalString(raw.href, MAX_URL);
  if (!href || !hasProtocol(href, ['http:', 'https:', 'mailto:'])) return null;
  return { ...base, href };
}

/** Device/OS/browser from the User-Agent, or null when the request looks automated. */
export function parseUserAgent(userAgent: string): ParsedUserAgent | null {
  if (!userAgent || BOT_PATTERN.test(userAgent)) return null;

  const parsed = Bowser.parse(userAgent);
  const platform = parsed.platform.type;
  if (platform === 'bot') return null;

  const device: DeviceType = platform === 'mobile' ? 'mobile' : platform === 'tablet' ? 'tablet' : 'desktop';
  return {
    device,
    os: parsed.os.name || 'Other',
    browser: parsed.browser.name || 'Other',
  };
}

function matchesHost(host: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith('.') ? host.includes(pattern) : host === pattern || host.endsWith(`.${pattern}`),
  );
}

/** Groups a referrer URL into a readable host and a source category. */
export function classifyReferrer(referrer: string | undefined, siteHost: string): { host: string; category: RefCategory } {
  if (!referrer) return { host: '(direct)', category: 'direct' };

  let hostname: string;
  try {
    hostname = new URL(referrer).hostname.toLowerCase();
  } catch {
    return { host: '(direct)', category: 'direct' };
  }

  if (hostname === siteHost || hostname === 'localhost') return { host: hostname, category: 'internal' };

  const host = hostname.replace(/^(www|m)\./, '');
  if (matchesHost(host, SEARCH_HOSTS)) return { host, category: 'search' };
  if (matchesHost(host, SOCIAL_HOSTS)) return { host, category: 'social' };
  return { host, category: 'other' };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kst(ms: number): Date {
  return new Date(ms + KST_OFFSET_MS);
}

/** YYYY-MM-DD in Korea Standard Time; the day boundary visitors see. */
export function kstDate(ms: number): string {
  return kst(ms).toISOString().slice(0, 10);
}

export function kstHour(ms: number): number {
  return kst(ms).getUTCHours();
}

/** 0 = Sunday … 6 = Saturday, in KST. */
export function kstWeekday(ms: number): number {
  return kst(ms).getUTCDay();
}

export function screenBucket(width: number | undefined): string {
  if (!width) return 'unknown';
  if (width <= 480) return '~480';
  if (width <= 768) return '~768';
  if (width <= 1024) return '~1024';
  if (width <= 1440) return '~1440';
  return '1441+';
}
