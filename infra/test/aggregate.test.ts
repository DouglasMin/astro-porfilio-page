import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, countLiveVisitors, type StoredEvent } from '../lambda/shared/aggregate.ts';

// 2026-09-24 10:00 KST (Thursday)
const T0 = Date.UTC(2026, 8, 24, 1, 0);
const MIN = 60_000;

function pv(partial: Partial<StoredEvent> & Pick<StoredEvent, 'vid' | 'sid' | 'path' | 'ts'>): StoredEvent {
  return {
    type: 'pv',
    refHost: '(direct)',
    refCategory: 'direct',
    device: 'desktop',
    os: 'macOS',
    browser: 'Chrome',
    screen: '~1440',
    lang: 'ko-KR',
    country: 'KR',
    city: 'Seoul',
    newVisitor: false,
    ...partial,
  };
}

const events: StoredEvent[] = [
  // Visitor A: new, arrives from Google on mobile, reads two pages
  pv({ ts: T0, vid: 'va', sid: 'sa', path: '/', refHost: 'google.com', refCategory: 'search', device: 'mobile', os: 'iOS', browser: 'Safari', newVisitor: true }),
  { type: 'leave', ts: T0 + 1 * MIN, vid: 'va', sid: 'sa', path: '/', duration: 60_000, scroll: 100 },
  pv({ ts: T0 + 1 * MIN, vid: 'va', sid: 'sa', path: '/blog/post-1', title: 'Post 1', refHost: 'main.site', refCategory: 'internal', device: 'mobile', os: 'iOS', browser: 'Safari' }),
  { type: 'leave', ts: T0 + 4 * MIN, vid: 'va', sid: 'sa', path: '/blog/post-1', duration: 180_000, scroll: 60 },
  { type: 'out', ts: T0 + 4 * MIN, vid: 'va', sid: 'sa', path: '/blog/post-1', href: 'https://github.com/DouglasMin' },

  // Visitor B: returning, LinkedIn campaign, bounces on the post
  pv({ ts: T0 + 30 * MIN, vid: 'vb', sid: 'sb', path: '/blog/post-1', title: 'Post 1', refHost: 'linkedin.com', refCategory: 'social', utmSource: 'linkedin', utmCampaign: 'launch', country: 'US', city: 'Seattle' }),
  { type: 'leave', ts: T0 + 31 * MIN, vid: 'vb', sid: 'sb', path: '/blog/post-1', duration: 30_000, scroll: 20 },

  // Visitor B again the next day
  pv({ ts: T0 + 24 * 60 * MIN, vid: 'vb', sid: 'sb2', path: '/projects', country: 'US', city: 'Seattle' }),
];

const dashboard = aggregate(events, { from: '2026-09-24', to: '2026-09-26' });

test('summary counts unique visitors, sessions and pageviews', () => {
  assert.equal(dashboard.summary.visitors, 2);
  assert.equal(dashboard.summary.newVisitors, 1);
  assert.equal(dashboard.summary.pageviews, 4);
  assert.equal(dashboard.summary.sessions, 3);
  assert.equal(dashboard.summary.pagesPerSession, 4 / 3);
});

test('bounce rate is the share of single-page sessions', () => {
  // sa has 2 pages, sb and sb2 have 1
  assert.equal(dashboard.summary.bounceRate, 2 / 3);
});

test('average session duration sums time on page per session', () => {
  // sa: 240s, sb: 30s, sb2: no leave event → 0
  assert.equal(dashboard.summary.avgSessionMs, (240_000 + 30_000 + 0) / 3);
});

test('daily series covers every day in range, including empty days', () => {
  assert.deepEqual(dashboard.daily, [
    { date: '2026-09-24', visitors: 2, pageviews: 3 },
    { date: '2026-09-25', visitors: 1, pageviews: 1 },
    { date: '2026-09-26', visitors: 0, pageviews: 0 },
  ]);
});

test('traffic sources are attributed by the session entry page, ignoring internal hops', () => {
  const byCategory = Object.fromEntries(dashboard.sourceCategories.map((row) => [row.label, row.sessions]));
  assert.deepEqual(byCategory, { search: 1, social: 1, direct: 1 });
  assert.ok(!dashboard.referrers.some((row) => row.label === 'main.site'));
  assert.deepEqual(dashboard.campaigns, [{ source: 'linkedin', medium: '', campaign: 'launch', sessions: 1 }]);
});

test('pages report views, unique visitors, time and scroll', () => {
  const post = dashboard.pages.find((row) => row.path === '/blog/post-1');
  assert.ok(post);
  assert.equal(post.title, 'Post 1');
  assert.equal(post.pageviews, 2);
  assert.equal(post.visitors, 2);
  assert.equal(post.avgTimeMs, (180_000 + 30_000) / 2);
  assert.equal(post.avgScroll, (60 + 20) / 2);
});

test('entry and exit pages come from session order', () => {
  assert.deepEqual(
    dashboard.entryPages.map((row) => [row.label, row.value]),
    [['/', 1], ['/blog/post-1', 1], ['/projects', 1]],
  );
  assert.equal(dashboard.exitPages.find((row) => row.label === '/blog/post-1')?.value, 2);
});

test('breakdowns count unique visitors per label', () => {
  assert.deepEqual(dashboard.devices, [
    { label: 'desktop', value: 1 },
    { label: 'mobile', value: 1 },
  ]);
  assert.deepEqual(dashboard.countries[0], { label: 'KR', value: 1 });
  assert.deepEqual(dashboard.cities.find((row) => row.label === 'Seattle, US'), { label: 'Seattle, US', value: 1 });
});

test('heatmap buckets pageviews by KST weekday and hour', () => {
  // Thursday = 4, 10:00 KST
  assert.equal(dashboard.heatmap[4]?.[10], 3);
  // Friday 10:00 KST
  assert.equal(dashboard.heatmap[5]?.[10], 1);
});

test('outbound clicks and scroll depth are summarised', () => {
  assert.deepEqual(dashboard.outbound, [{ label: 'https://github.com/DouglasMin', value: 1 }]);
  assert.deepEqual(dashboard.scrollDepth, [
    { label: '0-25%', value: 1 },
    { label: '26-50%', value: 0 },
    { label: '51-75%', value: 1 },
    { label: '76-100%', value: 1 },
  ]);
});

test('countLiveVisitors counts distinct visitors active in the window', () => {
  const now = T0 + 5 * MIN;
  assert.equal(countLiveVisitors(events, now, 5 * MIN), 1);
  assert.equal(countLiveVisitors(events, now, 1), 0);
});
