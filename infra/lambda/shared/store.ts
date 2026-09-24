import { randomUUID } from 'node:crypto';
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { StoredEvent } from './aggregate.ts';

export interface Counters {
  visitors: number;
  pageviews: number;
}

/** Storage operations the handlers need; DynamoDB in production, a fake in tests. */
export interface AnalyticsStore {
  putEvent(date: string, event: StoredEvent): Promise<void>;
  /** Records a visitor for the day. Resolves true only the first time that visitor is seen that day. */
  markVisit(date: string, vid: string): Promise<boolean>;
  incrementCounters(date: string, delta: Counters): Promise<void>;
  getCounters(date: string): Promise<{ today: Counters; total: Counters }>;
  queryEvents(date: string, sinceTs?: number): Promise<StoredEvent[]>;
}

const EVENT_RETENTION_DAYS = 400;
const VISIT_RETENTION_DAYS = 2;
const DAY_SECONDS = 24 * 60 * 60;
const TOTAL_KEY = 'C#ALL';

// Sort keys start with a fixed-width timestamp so a day partition reads in time order
const tsKey = (ts: number) => String(ts).padStart(15, '0');

function expiresAt(days: number): number {
  return Math.floor(Date.now() / 1000) + days * DAY_SECONDS;
}

function toCounters(item: Record<string, unknown> | undefined): Counters {
  return {
    visitors: typeof item?.visitors === 'number' ? item.visitors : 0,
    pageviews: typeof item?.pageviews === 'number' ? item.pageviews : 0,
  };
}

export function createDynamoStore(tableName: string, client = new DynamoDBClient({})): AnalyticsStore {
  const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

  async function addToCounter(pk: string, delta: Counters): Promise<void> {
    await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk, sk: 'C' },
        UpdateExpression: 'ADD visitors :v, pageviews :p',
        ExpressionAttributeValues: { ':v': delta.visitors, ':p': delta.pageviews },
      }),
    );
  }

  return {
    async putEvent(date, event) {
      await doc.send(
        new PutCommand({
          TableName: tableName,
          Item: { pk: `E#${date}`, sk: `${tsKey(event.ts)}#${randomUUID().slice(0, 8)}`, ...event, expiresAt: expiresAt(EVENT_RETENTION_DAYS) },
        }),
      );
    },

    async markVisit(date, vid) {
      try {
        await doc.send(
          new PutCommand({
            TableName: tableName,
            Item: { pk: `V#${date}`, sk: vid, expiresAt: expiresAt(VISIT_RETENTION_DAYS) },
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
        );
        return true;
      } catch (error: unknown) {
        if (error instanceof ConditionalCheckFailedException) return false;
        throw error;
      }
    },

    async incrementCounters(date, delta) {
      await Promise.all([addToCounter(`C#${date}`, delta), addToCounter(TOTAL_KEY, delta)]);
    },

    async getCounters(date) {
      const [today, total] = await Promise.all(
        [`C#${date}`, TOTAL_KEY].map((pk) => doc.send(new GetCommand({ TableName: tableName, Key: { pk, sk: 'C' } }))),
      );
      return { today: toCounters(today?.Item), total: toCounters(total?.Item) };
    },

    async queryEvents(date, sinceTs) {
      const events: StoredEvent[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const page = await doc.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: sinceTs === undefined ? 'pk = :pk' : 'pk = :pk AND sk > :since',
            ExpressionAttributeValues: {
              ':pk': `E#${date}`,
              ...(sinceTs === undefined ? {} : { ':since': tsKey(sinceTs) }),
            },
            ExclusiveStartKey: startKey,
          }),
        );
        for (const item of page.Items ?? []) {
          const { pk: _pk, sk: _sk, expiresAt: _expiresAt, ...event } = item;
          events.push(event as StoredEvent);
        }
        startKey = page.LastEvaluatedKey;
      } while (startKey);
      return events;
    },
  };
}
