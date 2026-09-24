import type { StoredEvent } from './aggregate.ts';
import type { AnalyticsStore, Counters } from './store.ts';

/** In-memory AnalyticsStore for tests and the local dev server. */
export class MemoryStore implements AnalyticsStore {
  readonly events: { date: string; event: StoredEvent }[] = [];
  private readonly visits = new Set<string>();
  readonly counters = new Map<string, Counters>();

  async putEvent(date: string, event: StoredEvent): Promise<void> {
    this.events.push({ date, event });
  }

  async markVisit(date: string, vid: string): Promise<boolean> {
    const key = `${date}|${vid}`;
    if (this.visits.has(key)) return false;
    this.visits.add(key);
    return true;
  }

  async incrementCounters(date: string, delta: Counters): Promise<void> {
    for (const key of [date, 'ALL']) {
      const current = this.counters.get(key) ?? { visitors: 0, pageviews: 0 };
      this.counters.set(key, { visitors: current.visitors + delta.visitors, pageviews: current.pageviews + delta.pageviews });
    }
  }

  async getCounters(date: string): Promise<{ today: Counters; total: Counters }> {
    const empty = { visitors: 0, pageviews: 0 };
    return { today: this.counters.get(date) ?? empty, total: this.counters.get('ALL') ?? empty };
  }

  async queryEvents(date: string, sinceTs?: number): Promise<StoredEvent[]> {
    return this.events
      .filter((row) => row.date === date && (sinceTs === undefined || row.event.ts > sinceTs))
      .map((row) => row.event);
  }
}
