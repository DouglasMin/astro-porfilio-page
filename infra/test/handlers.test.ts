import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { MemoryStore as FakeStore } from '../lambda/shared/memory-store.ts';
import { createCollectHandler } from '../lambda/collect.ts';
import { createPublicStatsHandler } from '../lambda/public-stats.ts';
import { createAdminStatsHandler } from '../lambda/admin-stats.ts';

const ORIGIN = 'https://main.d3m8pthmupwl40.amplifyapp.com';
const SITE_HOST = 'main.d3m8pthmupwl40.amplifyapp.com';
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
// 2026-09-24 10:00 KST
const NOW = Date.UTC(2026, 8, 24, 1, 0);
const TOKEN = 'correct-horse-battery-staple-0123456789';

function request(overrides: {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}): APIGatewayProxyEventV2 {
  return {
    requestContext: { http: { method: overrides.method ?? 'POST' } },
    headers: { origin: ORIGIN, 'user-agent': CHROME, ...overrides.headers },
    body: overrides.body === undefined ? undefined : typeof overrides.body === 'string' ? overrides.body : JSON.stringify(overrides.body),
    isBase64Encoded: false,
    queryStringParameters: overrides.query,
  } as unknown as APIGatewayProxyEventV2;
}

async function call(handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>, event: APIGatewayProxyEventV2) {
  return handler(event);
}

const pageview = { t: 'pv', vid: 'v-aaaaaaaaaa', sid: 's-aaaaaaaaaa', path: '/blog/x', ref: 'https://www.google.com/', sw: 1440, nv: true };

test('collect stores an enriched pageview and counts the first daily visit', async () => {
  const store = new FakeStore();
  const handler = createCollectHandler({ store, allowedOrigins: [ORIGIN], siteHost: SITE_HOST, now: () => NOW });

  const response = await call(
    handler,
    request({ body: pageview, headers: { 'cloudfront-viewer-country': 'KR', 'cloudfront-viewer-city': 'Seongnam-si', 'cloudfront-viewer-country-region-name': 'Gyeonggi-do' } }),
  );

  assert.equal(response.statusCode, 204);
  assert.equal(store.events.length, 1);
  const stored = store.events[0];
  assert.equal(stored?.date, '2026-09-24');
  assert.equal(stored?.event.refCategory, 'search');
  assert.equal(stored?.event.refHost, 'google.com');
  assert.equal(stored?.event.device, 'desktop');
  assert.equal(stored?.event.browser, 'Chrome');
  assert.equal(stored?.event.country, 'KR');
  assert.equal(stored?.event.city, 'Seongnam-si');
  assert.equal(stored?.event.screen, '~1440');
  assert.equal(stored?.event.newVisitor, true);
  assert.deepEqual(store.counters.get('2026-09-24'), { visitors: 1, pageviews: 1 });

  await call(handler, request({ body: { ...pageview, path: '/projects', nv: false } }));
  assert.deepEqual(store.counters.get('2026-09-24'), { visitors: 1, pageviews: 2 });
});

test('collect decodes percent-encoded city names from CloudFront', async () => {
  const store = new FakeStore();
  const handler = createCollectHandler({ store, allowedOrigins: [ORIGIN], siteHost: SITE_HOST, now: () => NOW });
  await call(handler, request({ body: pageview, headers: { 'cloudfront-viewer-city': 'S%C3%A3o%20Paulo' } }));
  assert.equal(store.events[0]?.event.city, 'São Paulo');
});

test('collect stores leave events without touching counters', async () => {
  const store = new FakeStore();
  const handler = createCollectHandler({ store, allowedOrigins: [ORIGIN], siteHost: SITE_HOST, now: () => NOW });
  const response = await call(handler, request({ body: { t: 'leave', vid: 'v-aaaaaaaaaa', sid: 's-aaaaaaaaaa', path: '/', dur: 5000, scroll: 40 } }));
  assert.equal(response.statusCode, 204);
  assert.equal(store.events[0]?.event.duration, 5000);
  assert.equal(store.counters.size, 0);
});

test('collect ignores bots, foreign origins and invalid bodies', async () => {
  const store = new FakeStore();
  const handler = createCollectHandler({ store, allowedOrigins: [ORIGIN], siteHost: SITE_HOST, now: () => NOW });

  const bot = await call(handler, request({ body: pageview, headers: { 'user-agent': 'Googlebot/2.1' } }));
  const foreign = await call(handler, request({ body: pageview, headers: { origin: 'https://evil.example' } }));
  const invalid = await call(handler, request({ body: '{"t":"pv"}' }));

  assert.equal(bot.statusCode, 204);
  assert.equal(foreign.statusCode, 403);
  assert.equal(invalid.statusCode, 400);
  assert.equal(store.events.length, 0);
});

test('public stats returns today and total visitors with a short cache', async () => {
  const store = new FakeStore();
  await store.incrementCounters('2026-09-24', { visitors: 3, pageviews: 7 });
  await store.incrementCounters('2026-09-23', { visitors: 5, pageviews: 9 });
  const handler = createPublicStatsHandler({ store, now: () => NOW });

  const response = await call(handler, request({ method: 'GET' }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(String(response.body)), { today: 3, total: 8 });
  assert.match(String(response.headers?.['cache-control']), /max-age=60/);
});

test('admin stats rejects missing or wrong tokens', async () => {
  const handler = createAdminStatsHandler({ store: new FakeStore(), getToken: async () => TOKEN, now: () => NOW });
  const missing = await call(handler, request({ method: 'GET' }));
  const wrong = await call(handler, request({ method: 'GET', headers: { 'x-admin-token': 'nope' } }));
  assert.equal(missing.statusCode, 401);
  assert.equal(wrong.statusCode, 401);
});

test('admin stats validates the date range', async () => {
  const handler = createAdminStatsHandler({ store: new FakeStore(), getToken: async () => TOKEN, now: () => NOW });
  const headers = { 'x-admin-token': TOKEN };
  const bad = await call(handler, request({ method: 'GET', headers, query: { from: 'yesterday', to: '2026-09-24' } }));
  const reversed = await call(handler, request({ method: 'GET', headers, query: { from: '2026-09-24', to: '2026-09-01' } }));
  const tooLong = await call(handler, request({ method: 'GET', headers, query: { from: '2025-01-01', to: '2026-09-24' } }));
  assert.equal(bad.statusCode, 400);
  assert.equal(reversed.statusCode, 400);
  assert.equal(tooLong.statusCode, 400);
});

test('admin stats aggregates the requested range and reports live visitors', async () => {
  const store = new FakeStore();
  const collect = createCollectHandler({ store, allowedOrigins: [ORIGIN], siteHost: SITE_HOST, now: () => NOW - 60_000 });
  await call(collect, request({ body: pageview }));

  const handler = createAdminStatsHandler({ store, getToken: async () => TOKEN, now: () => NOW });
  const response = await call(handler, request({ method: 'GET', headers: { 'x-admin-token': TOKEN } }));
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(String(response.body));
  assert.deepEqual(body.range, { from: '2026-09-18', to: '2026-09-24' });
  assert.equal(body.summary.pageviews, 1);
  assert.equal(body.daily.length, 7);
  assert.equal(body.live, 1);
  assert.deepEqual(body.counters, { today: 1, total: 1 });
});
