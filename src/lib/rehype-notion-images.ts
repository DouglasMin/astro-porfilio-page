/**
 * Rehype plugin that replaces Notion-hosted image URLs with locally optimized
 * WebP paths from the image cache.
 *
 * Notion image URLs typically look like:
 *   - https://prod-files-secure.s3.us-west-2.amazonaws.com/...
 *   - https://s3.us-west-2.amazonaws.com/...
 *
 * The plugin reads `.image-cache.json` at build time and rewrites matching
 * `src` attributes on `<img>` elements to their local `/images/blog/...` paths.
 * It also adds intrinsic `width`/`height` so lazy-loaded images reserve their
 * space and never shift the layout (or TOC jump targets) as they load.
 *
 * `<video>` uploads are pointed at the MP4 + poster from `.video-cache.json`
 * (see scripts/notion-videos.ts) and given real player attributes.
 */

import * as fs from 'node:fs';
import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

interface ImageCacheEntry {
  notionUrl: string;
  localPath: string;
  hash: string;
  width?: number;
  height?: number;
  lastSynced: string;
}

interface ImageCache {
  [notionUrl: string]: ImageCacheEntry;
}

interface VideoCacheEntry {
  notionUrl: string;
  localPath: string;
  posterPath: string;
  width: number;
  height: number;
  lastSynced: string;
}

interface VideoCache {
  [notionUrl: string]: VideoCacheEntry;
}

const NOTION_IMAGE_PATTERN =
  /^https?:\/\/(?:prod-files-secure\.s3\.us-west-2\.amazonaws\.com|s3\.us-west-2\.amazonaws\.com)\//;

function loadCache<T extends object>(cacheFile: string): T {
  try {
    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as T;
    }
  } catch {
    // Cache missing or corrupt — silently fall back to no replacements
  }
  return {} as T;
}

/**
 * Try to match a Notion image URL against the cache.
 *
 * Notion image URLs contain signed query parameters that change on every API
 * call, so we strip query strings before comparing. The cache keys are the
 * original URLs captured during sync, but the base path (before `?`) is stable
 * for the same image.
 */
function findCacheEntry<T>(url: string, cache: Record<string, T>): T | undefined {
  // Direct match (unlikely due to signed URLs, but cheap to check)
  if (cache[url]) {
    return cache[url];
  }

  // Strip query string and compare base paths
  const baseUrl = url.split('?')[0];
  for (const [cachedUrl, entry] of Object.entries(cache)) {
    if (cachedUrl.split('?')[0] === baseUrl) {
      return entry;
    }
  }

  return undefined;
}

/** notion-rehype-k passes a video's Notion file object ({ url, expiry_time }) through as `src`. */
function notionFileUrl(src: unknown): string | undefined {
  if (typeof src === 'string') return src;
  if (src && typeof src === 'object' && 'url' in src && typeof src.url === 'string') return src.url;
  return undefined;
}

function rewriteImage(node: Element, cache: ImageCache): void {
  const src = node.properties?.src;
  if (typeof src !== 'string') return;
  if (!NOTION_IMAGE_PATTERN.test(src)) return;

  const entry = findCacheEntry(src, cache);
  if (!entry) return;

  node.properties = {
    ...node.properties,
    src: entry.localPath,
    ...(entry.width && entry.height ? { width: entry.width, height: entry.height } : {}),
    loading: 'lazy',
    decoding: 'async',
  };
}

/**
 * Point a Notion video upload at its transcoded MP4 and poster. Without a
 * synced copy the signed Notion URL is kept, so it still plays until it expires.
 */
function rewriteVideo(node: Element, cache: VideoCache): void {
  const src = notionFileUrl(node.properties?.src as unknown);
  if (!src) return;

  const entry = findCacheEntry(src, cache);
  node.properties = {
    ...node.properties,
    src: entry?.localPath ?? src,
    ...(entry
      ? {
          poster: entry.posterPath,
          width: entry.width,
          height: entry.height,
          // Lets CSS size portrait clips by height without a layout shift
          style: `--media-aspect: ${(entry.width / entry.height).toFixed(4)}`,
        }
      : {}),
    controls: true,
    playsInline: true,
    preload: 'metadata',
  };
}

export interface RehypeNotionImagesOptions {
  cacheFile?: string;
  videoCacheFile?: string;
}

/**
 * Rehype plugin factory.
 */
export function rehypeNotionImages(options: RehypeNotionImagesOptions = {}) {
  const imageCache = loadCache<ImageCache>(options.cacheFile ?? '.image-cache.json');
  const videoCache = loadCache<VideoCache>(options.videoCacheFile ?? '.video-cache.json');

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img') rewriteImage(node, imageCache);
      else if (node.tagName === 'video') rewriteVideo(node, videoCache);
    });
  };
}

export default rehypeNotionImages;
