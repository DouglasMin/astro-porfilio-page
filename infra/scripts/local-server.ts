/**
 * Runs the real Lambda handlers against an in-memory store for local development.
 *   npm run local            → http://localhost:8787
 * Build the site with PUBLIC_ANALYTICS_URL=http://localhost:8787 to use it.
 */
import { createServer, type IncomingMessage } from 'node:http';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createAdminStatsHandler } from '../lambda/admin-stats.ts';
import { createCollectHandler } from '../lambda/collect.ts';
import { createPublicStatsHandler } from '../lambda/public-stats.ts';
import { MemoryStore } from '../lambda/shared/memory-store.ts';

const PORT = Number(process.env.PORT ?? 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'local-admin-token';
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4321,http://localhost:4399').split(',');

const store = new MemoryStore();
const routes = {
  'POST /collect': createCollectHandler({ store, allowedOrigins: ORIGINS, siteHost: 'localhost', now: Date.now }),
  'GET /stats/public': createPublicStatsHandler({ store, now: Date.now }),
  'GET /stats': createAdminStatsHandler({ store, getToken: async () => ADMIN_TOKEN, now: Date.now }),
} as const;

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  const origin = request.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-allow-headers', 'content-type, x-admin-token');
    response.setHeader('access-control-allow-methods', 'GET, POST');
  }
  if (request.method === 'OPTIONS') return void response.writeHead(204).end();

  const route = routes[`${request.method} ${url.pathname}` as keyof typeof routes];
  if (!route) return void response.writeHead(404).end();

  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, String(value)]));
  const event = {
    requestContext: { http: { method: request.method } },
    headers: { ...headers, 'cloudfront-viewer-country': 'KR', 'cloudfront-viewer-city': 'Seoul' },
    body: await readBody(request),
    isBase64Encoded: false,
    queryStringParameters: Object.fromEntries(url.searchParams),
  } as unknown as APIGatewayProxyEventV2;

  const result = await route(event);
  response.writeHead(result.statusCode ?? 200, result.headers as Record<string, string>).end(result.body ?? '');
}).listen(PORT, () => {
  process.stdout.write(`analytics local server on http://localhost:${PORT} (admin token: ${ADMIN_TOKEN})\n`);
});
