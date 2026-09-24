import { aggregate, countLiveVisitors, type StoredEvent } from './shared/aggregate.ts';
import { createSecretTokenReader, tokensMatch } from './shared/auth.ts';
import { requireEnv } from './shared/config.ts';
import { kstDate } from './shared/event.ts';
import { json, type Handler } from './shared/http.ts';
import { createDynamoStore, type AnalyticsStore } from './shared/store.ts';

interface AdminStatsDeps {
  store: AnalyticsStore;
  getToken: () => Promise<string>;
  now: () => number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 92;
const LIVE_WINDOW_MS = 5 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const QUERY_CONCURRENCY = 8;

type Range = { from: string; to: string };

function daysBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= Date.parse(`${to}T00:00:00Z`); ms += DAY_MS) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

function parseRange(query: Record<string, string | undefined> | undefined, nowMs: number): Range | string {
  const to = query?.to ?? kstDate(nowMs);
  const from = query?.from ?? kstDate(nowMs - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return 'from/to must be YYYY-MM-DD';
  }
  if (from > to) return 'from must not be after to';
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) return `range must be at most ${MAX_RANGE_DAYS} days`;
  return { from, to };
}

async function queryDays(store: AnalyticsStore, dates: string[]): Promise<StoredEvent[]> {
  const results: StoredEvent[][] = [];
  for (let index = 0; index < dates.length; index += QUERY_CONCURRENCY) {
    const batch = dates.slice(index, index + QUERY_CONCURRENCY);
    results.push(...(await Promise.all(batch.map((date) => store.queryEvents(date)))));
  }
  return results.flat();
}

export function createAdminStatsHandler({ store, getToken, now }: AdminStatsDeps): Handler {
  return async (request) => {
    if (!tokensMatch(request.headers?.['x-admin-token'], await getToken())) {
      return json(401, { error: '인증에 실패했습니다. 관리자 토큰을 확인하세요.' });
    }

    const nowMs = now();
    const range = parseRange(request.queryStringParameters, nowMs);
    if (typeof range === 'string') return json(400, { error: range });

    const today = kstDate(nowMs);
    const [events, recent, counters] = await Promise.all([
      queryDays(store, daysBetween(range.from, range.to)),
      store.queryEvents(today, nowMs - LIVE_WINDOW_MS),
      store.getCounters(today),
    ]);

    return json(
      200,
      {
        ...aggregate(events, range),
        live: countLiveVisitors(recent, nowMs, LIVE_WINDOW_MS),
        counters: { today: counters.today.visitors, total: counters.total.visitors },
        generatedAt: new Date(nowMs).toISOString(),
      },
      { 'cache-control': 'no-store' },
    );
  };
}

let handlerInstance: Handler | undefined;

export const handler: Handler = (request) => {
  handlerInstance ??= createAdminStatsHandler({
    store: createDynamoStore(requireEnv('TABLE_NAME')),
    getToken: createSecretTokenReader(requireEnv('ADMIN_TOKEN_SECRET_ARN')),
    now: Date.now,
  });
  return handlerInstance(request);
};
