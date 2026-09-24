import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

export function json(statusCode: number, body: unknown, headers: Record<string, string> = {}): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(body),
  };
}

export function empty(statusCode: number): APIGatewayProxyStructuredResultV2 {
  return { statusCode };
}

export function requestBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) return '';
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

/** CloudFront viewer headers may be percent-encoded; fall back to the raw value if decoding fails. */
export function headerValue(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const value = event.headers?.[name];
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
