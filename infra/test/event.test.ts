import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyReferrer,
  kstDate,
  kstHour,
  kstWeekday,
  parseCollectPayload,
  parseUserAgent,
  screenBucket,
} from '../lambda/shared/event.ts';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36';

const VID = 'v-1a2b3c4d5e6f';
const SID = 's-9f8e7d6c5b4a';

test('parseCollectPayload accepts a valid pageview and trims fields', () => {
  const event = parseCollectPayload(
    JSON.stringify({
      t: 'pv',
      vid: VID,
      sid: SID,
      path: '/blog/abc',
      title: 'x'.repeat(500),
      ref: 'https://www.google.com/',
      utm: { source: 'linkedin', medium: 'social', campaign: 'launch' },
      sw: 390,
      lang: 'ko-KR',
      nv: true,
    }),
  );
  assert.ok(event);
  assert.equal(event.t, 'pv');
  assert.equal(event.path, '/blog/abc');
  assert.equal(event.title?.length, 200);
  assert.equal(event.utm?.source, 'linkedin');
  assert.equal(event.nv, true);
});

test('parseCollectPayload accepts leave and outbound events', () => {
  const leave = parseCollectPayload(JSON.stringify({ t: 'leave', vid: VID, sid: SID, path: '/', dur: 12345, scroll: 80 }));
  assert.equal(leave?.t, 'leave');
  assert.equal(leave?.dur, 12345);
  assert.equal(leave?.scroll, 80);

  const out = parseCollectPayload(JSON.stringify({ t: 'out', vid: VID, sid: SID, path: '/', href: 'https://github.com/DouglasMin' }));
  assert.equal(out?.t, 'out');
  assert.equal(out?.href, 'https://github.com/DouglasMin');

  const mail = parseCollectPayload(JSON.stringify({ t: 'out', vid: VID, sid: SID, path: '/about', href: 'mailto:dongik20@naver.com' }));
  assert.equal(mail?.href, 'mailto:dongik20@naver.com');
});

test('parseCollectPayload rejects malformed or hostile input', () => {
  const cases: unknown[] = [
    'not json',
    { t: 'pv', vid: VID, sid: SID },
    { t: 'unknown', vid: VID, sid: SID, path: '/' },
    { t: 'pv', vid: 'bad id!', sid: SID, path: '/' },
    { t: 'pv', vid: VID, sid: SID, path: 'https://evil.example/' },
    { t: 'pv', vid: VID, sid: SID, path: '/' + 'a'.repeat(600) },
    { t: 'out', vid: VID, sid: SID, path: '/', href: 'javascript:alert(1)' },
    { t: 'leave', vid: VID, sid: SID, path: '/', dur: -5, scroll: 50 },
  ];
  for (const input of cases) {
    const body = typeof input === 'string' ? input : JSON.stringify(input);
    assert.equal(parseCollectPayload(body), null, `should reject ${body.slice(0, 60)}`);
  }
});

test('parseCollectPayload clamps leave metrics to sane ranges', () => {
  const event = parseCollectPayload(
    JSON.stringify({ t: 'leave', vid: VID, sid: SID, path: '/', dur: 99_999_999, scroll: 250 }),
  );
  assert.equal(event?.dur, 30 * 60 * 1000);
  assert.equal(event?.scroll, 100);
});

test('parseCollectPayload rejects oversized bodies', () => {
  assert.equal(parseCollectPayload('x'.repeat(5000)), null);
});

test('parseUserAgent detects device, os and browser', () => {
  assert.deepEqual(parseUserAgent(IPHONE_SAFARI), { device: 'mobile', os: 'iOS', browser: 'Safari' });
  assert.deepEqual(parseUserAgent(MAC_CHROME), { device: 'desktop', os: 'macOS', browser: 'Chrome' });
  assert.equal(parseUserAgent(IPAD)?.device, 'tablet');
});

test('parseUserAgent returns null for bots and headless browsers', () => {
  assert.equal(parseUserAgent(GOOGLEBOT), null);
  assert.equal(parseUserAgent(HEADLESS), null);
  assert.equal(parseUserAgent(''), null);
});

test('classifyReferrer groups sources', () => {
  const site = 'main.d3m8pthmupwl40.amplifyapp.com';
  assert.deepEqual(classifyReferrer(undefined, site), { host: '(direct)', category: 'direct' });
  assert.deepEqual(classifyReferrer('https://www.google.com/', site), { host: 'google.com', category: 'search' });
  assert.deepEqual(classifyReferrer('https://search.naver.com/search.naver?query=x', site), {
    host: 'search.naver.com',
    category: 'search',
  });
  assert.deepEqual(classifyReferrer('https://www.linkedin.com/feed/', site), { host: 'linkedin.com', category: 'social' });
  assert.deepEqual(classifyReferrer('https://github.com/DouglasMin', site), { host: 'github.com', category: 'other' });
  assert.deepEqual(classifyReferrer(`https://${site}/blog`, site), { host: site, category: 'internal' });
  assert.deepEqual(classifyReferrer('not a url', site), { host: '(direct)', category: 'direct' });
});

test('KST date helpers use Asia/Seoul regardless of server timezone', () => {
  // 2026-09-24 15:30 UTC is 2026-09-25 00:30 KST (Friday)
  const ts = Date.UTC(2026, 8, 24, 15, 30);
  assert.equal(kstDate(ts), '2026-09-25');
  assert.equal(kstHour(ts), 0);
  assert.equal(kstWeekday(ts), 5);
});

test('screenBucket groups widths into device classes', () => {
  assert.equal(screenBucket(375), '~480');
  assert.equal(screenBucket(820), '~1024');
  assert.equal(screenBucket(1440), '~1440');
  assert.equal(screenBucket(2560), '1441+');
  assert.equal(screenBucket(undefined), 'unknown');
});
