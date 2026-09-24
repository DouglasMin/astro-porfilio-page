import type { StoredEvent } from './shared/aggregate.ts';
import { requireEnv } from './shared/config.ts';
import { classifyReferrer, kstDate, parseCollectPayload, parseUserAgent, screenBucket } from './shared/event.ts';
import { empty, headerValue, requestBody, type Handler } from './shared/http.ts';
import { createDynamoStore, type AnalyticsStore } from './shared/store.ts';

interface CollectDeps {
  store: AnalyticsStore;
  allowedOrigins: string[];
  siteHost: string;
  now: () => number;
}

export function createCollectHandler({ store, allowedOrigins, siteHost, now }: CollectDeps): Handler {
  return async (request) => {
    const origin = request.headers?.origin;
    if (!origin || !allowedOrigins.includes(origin)) return empty(403);

    const payload = parseCollectPayload(requestBody(request));
    if (!payload) return empty(400);

    // Automated traffic is acknowledged but never stored
    const agent = parseUserAgent(request.headers?.['user-agent'] ?? '');
    if (!agent) return empty(204);

    const ts = now();
    const date = kstDate(ts);
    const base: StoredEvent = { type: payload.t, ts, vid: payload.vid, sid: payload.sid, path: payload.path };

    if (payload.t === 'leave') {
      await store.putEvent(date, { ...base, duration: payload.dur, scroll: payload.scroll });
      return empty(204);
    }

    if (payload.t === 'out') {
      await store.putEvent(date, { ...base, href: payload.href });
      return empty(204);
    }

    const referrer = classifyReferrer(payload.ref, siteHost);
    const event: StoredEvent = {
      ...base,
      title: payload.title,
      refHost: referrer.host,
      refCategory: referrer.category,
      utmSource: payload.utm?.source,
      utmMedium: payload.utm?.medium,
      utmCampaign: payload.utm?.campaign,
      device: agent.device,
      os: agent.os,
      browser: agent.browser,
      screen: screenBucket(payload.sw),
      lang: payload.lang,
      country: headerValue(request, 'cloudfront-viewer-country'),
      region: headerValue(request, 'cloudfront-viewer-country-region-name'),
      city: headerValue(request, 'cloudfront-viewer-city'),
      newVisitor: payload.nv,
    };

    const firstVisitToday = await store.markVisit(date, payload.vid);
    await Promise.all([
      store.putEvent(date, event),
      store.incrementCounters(date, { visitors: firstVisitToday ? 1 : 0, pageviews: 1 }),
    ]);
    return empty(204);
  };
}

let handlerInstance: Handler | undefined;

export const handler: Handler = (request) => {
  handlerInstance ??= createCollectHandler({
    store: createDynamoStore(requireEnv('TABLE_NAME')),
    allowedOrigins: requireEnv('ALLOWED_ORIGINS').split(','),
    siteHost: requireEnv('SITE_HOST'),
    now: Date.now,
  });
  return handlerInstance(request);
};
