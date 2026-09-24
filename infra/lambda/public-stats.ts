import { requireEnv } from './shared/config.ts';
import { kstDate } from './shared/event.ts';
import { json, type Handler } from './shared/http.ts';
import { createDynamoStore, type AnalyticsStore } from './shared/store.ts';

interface PublicStatsDeps {
  store: AnalyticsStore;
  now: () => number;
}

/** Today's and all-time visitor counts for the site footer. */
export function createPublicStatsHandler({ store, now }: PublicStatsDeps): Handler {
  return async () => {
    const { today, total } = await store.getCounters(kstDate(now()));
    return json(200, { today: today.visitors, total: total.visitors }, { 'cache-control': 'public, max-age=60' });
  };
}

let handlerInstance: Handler | undefined;

export const handler: Handler = (request) => {
  handlerInstance ??= createPublicStatsHandler({ store: createDynamoStore(requireEnv('TABLE_NAME')), now: Date.now });
  return handlerInstance(request);
};
