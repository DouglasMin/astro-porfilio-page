/** Fills the footer counter from the public stats endpoint, at most once a minute. */

const ENDPOINT = import.meta.env.PUBLIC_ANALYTICS_URL as string | undefined;
const REFRESH_MS = 60_000;

interface PublicStats {
  today: number;
  total: number;
}

let cached: { stats: PublicStats; fetchedAt: number } | undefined;

function isPublicStats(value: unknown): value is PublicStats {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PublicStats).today === 'number' &&
    typeof (value as PublicStats).total === 'number'
  );
}

async function loadStats(): Promise<PublicStats | undefined> {
  if (cached && Date.now() - cached.fetchedAt < REFRESH_MS) return cached.stats;
  const response = await fetch(`${ENDPOINT}/stats/public`);
  if (!response.ok) return undefined;
  const body: unknown = await response.json();
  if (!isPublicStats(body)) return undefined;
  cached = { stats: body, fetchedAt: Date.now() };
  return body;
}

async function render(): Promise<void> {
  const element = document.getElementById('visitor-count');
  if (!element || !ENDPOINT) return;
  try {
    const stats = await loadStats();
    if (!stats) return;
    const format = (value: number) => value.toLocaleString('ko-KR');
    element.querySelector('[data-today]')!.textContent = format(stats.today);
    element.querySelector('[data-total]')!.textContent = format(stats.total);
    element.hidden = false;
  } catch {
    // The counter is decorative; leave it hidden if the API is unreachable
  }
}

export function initVisitorCount(): void {
  document.addEventListener('astro:page-load', () => void render());
}
