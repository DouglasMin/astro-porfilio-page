/**
 * Cookie-free visitor analytics. Sends a pageview on every Astro page load,
 * plus time-on-page, scroll depth and outbound link clicks.
 * Does nothing unless PUBLIC_ANALYTICS_URL is set at build time.
 */

const ENDPOINT = import.meta.env.PUBLIC_ANALYTICS_URL as string | undefined;

const VISITOR_KEY = 'a_vid';
const SESSION_KEY = 'a_session';
/** Set on this browser by the owner (via /admin) so their own visits are not counted. */
export const IGNORE_KEY = 'a_ignore';
const SESSION_IDLE_MS = 30 * 60 * 1000;

interface Session {
  id: string;
  lastSeen: number;
}

interface PageState {
  path: string;
  visibleSince: number | undefined;
  visibleMs: number;
  maxScroll: number;
  sent: boolean;
}

let page: PageState | undefined;
let previousUrl: string | undefined;
let listenersBound = false;

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: fall back to per-page ids
  }
}

function visitor(): { id: string; isNew: boolean } {
  const existing = readStorage(localStorage, VISITOR_KEY);
  if (existing) return { id: existing, isNew: false };
  const id = randomId('v');
  writeStorage(localStorage, VISITOR_KEY, id);
  return { id, isNew: true };
}

/** A session ends after 30 minutes without activity, like most analytics tools. */
function session(now: number): { id: string; isNew: boolean } {
  let current: Session | undefined;
  try {
    current = JSON.parse(readStorage(sessionStorage, SESSION_KEY) ?? 'null') ?? undefined;
  } catch {
    current = undefined;
  }
  const isNew = !current || now - current.lastSeen > SESSION_IDLE_MS;
  const next: Session = { id: isNew || !current ? randomId('s') : current.id, lastSeen: now };
  writeStorage(sessionStorage, SESSION_KEY, JSON.stringify(next));
  return { id: next.id, isNew };
}

function send(payload: Record<string, unknown>): void {
  if (!ENDPOINT) return;
  const body = JSON.stringify(payload);
  // text/plain keeps this a "simple" request, so no CORS preflight
  const blob = new Blob([body], { type: 'text/plain' });
  if (navigator.sendBeacon?.(`${ENDPOINT}/collect`, blob)) return;
  void fetch(`${ENDPOINT}/collect`, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(
    () => undefined,
  );
}

function scrollPercent(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
}

function utmParams(): Record<string, string> | undefined {
  const params = new URLSearchParams(window.location.search);
  const utm = {
    source: params.get('utm_source') ?? undefined,
    medium: params.get('utm_medium') ?? undefined,
    campaign: params.get('utm_campaign') ?? undefined,
  };
  return utm.source || utm.medium || utm.campaign ? (utm as Record<string, string>) : undefined;
}

function ids(): { vid: string; sid: string } {
  return { vid: visitor().id, sid: session(Date.now()).id };
}

/** Sends time-on-page and scroll depth once per pageview. */
function flushPage(): void {
  if (!page || page.sent) return;
  const now = performance.now();
  const visibleMs = page.visibleMs + (page.visibleSince === undefined ? 0 : now - page.visibleSince);
  page.sent = true;
  send({ t: 'leave', ...ids(), path: page.path, dur: Math.round(visibleMs), scroll: Math.max(page.maxScroll, scrollPercent()) });
}

function isTrackingDisabled(): boolean {
  return (
    !ENDPOINT ||
    navigator.webdriver ||
    readStorage(localStorage, IGNORE_KEY) === '1' ||
    window.location.pathname.startsWith('/admin')
  );
}

function trackPageview(): void {
  if (isTrackingDisabled()) return;

  const now = Date.now();
  const who = visitor();
  const current = session(now);
  const path = window.location.pathname;

  page = {
    path,
    visibleSince: document.visibilityState === 'visible' ? performance.now() : undefined,
    visibleMs: 0,
    maxScroll: scrollPercent(),
    sent: false,
  };

  send({
    t: 'pv',
    vid: who.id,
    sid: current.id,
    path,
    title: document.title,
    // Client-side navigations keep the original document.referrer, so use the previous page instead
    ref: previousUrl ?? (document.referrer || undefined),
    utm: utmParams(),
    sw: window.screen.width,
    lang: navigator.language,
    nv: who.isNew,
  });
  previousUrl = window.location.href;
}

function bindListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  window.addEventListener(
    'scroll',
    () => {
      if (page) page.maxScroll = Math.max(page.maxScroll, scrollPercent());
    },
    { passive: true },
  );

  document.addEventListener('visibilitychange', () => {
    if (!page) return;
    if (document.visibilityState === 'hidden') {
      if (page.visibleSince !== undefined) page.visibleMs += performance.now() - page.visibleSince;
      page.visibleSince = undefined;
      flushPage();
    } else {
      page.visibleSince = performance.now();
    }
  });

  window.addEventListener('pagehide', flushPage);
  document.addEventListener('astro:before-preparation', flushPage);

  document.addEventListener('click', (event) => {
    if (isTrackingDisabled() || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!(link instanceof HTMLAnchorElement)) return;
    const isExternal = link.protocol === 'mailto:' || (link.host !== '' && link.host !== window.location.host);
    if (isExternal) {
      send({ t: 'out', ...ids(), path: window.location.pathname, href: link.href });
    }
  });
}

export function initAnalytics(): void {
  bindListeners();
  document.addEventListener('astro:page-load', trackPageview);
}
