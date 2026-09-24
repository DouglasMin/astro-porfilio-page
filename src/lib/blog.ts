import type { CollectionEntry } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;

export interface PostSummary {
  id: string;
  title: string;
  description: string;
  publishedAt: Date;
  tags: string[];
}

export const PAGE_SIZE = 5;

// Korean prose reads at roughly 500 characters per minute
const CHARS_PER_MINUTE = 500;

function richTextToPlainText(data: ReadonlyArray<{ plain_text: string }>): string {
  return data.map((text) => text.plain_text).join('');
}

/** Flattens a notion-astro-loader entry into the fields the pages render. */
export function getPostData(entry: BlogEntry): PostSummary {
  const props = entry.data.properties;
  const publishedStart = props['Published Date']?.date?.start;
  return {
    id: entry.id,
    title: richTextToPlainText(props.Title?.title ?? []),
    description: richTextToPlainText(props.Description?.rich_text ?? []),
    publishedAt: publishedStart ? new Date(publishedStart) : new Date(),
    tags: props.Tags?.multi_select?.map((t: { name: string }) => t.name) ?? [],
  };
}

/** Newest first, as the list pages show them. */
export function toSortedPosts(entries: BlogEntry[]): PostSummary[] {
  return entries
    .map((entry) => getPostData(entry))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export function readingMinutes(entry: BlogEntry): number {
  const text = (entry.rendered?.html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  return Math.max(1, Math.round(text.length / CHARS_PER_MINUTE));
}

/** 2026.07.09 — compact, sortable, and the same width for every row. */
export function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}
