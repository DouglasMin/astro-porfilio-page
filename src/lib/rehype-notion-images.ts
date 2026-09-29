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

const NOTION_IMAGE_PATTERN =
  /^https?:\/\/(?:prod-files-secure\.s3\.us-west-2\.amazonaws\.com|s3\.us-west-2\.amazonaws\.com)\//;

function loadImageCache(cacheFile: string): ImageCache {
  try {
    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as ImageCache;
    }
  } catch {
    // Cache missing or corrupt — silently fall back to no replacements
  }
  return {};
}

/**
 * Try to match a Notion image URL against the cache.
 *
 * Notion image URLs contain signed query parameters that change on every API
 * call, so we strip query strings before comparing. The cache keys are the
 * original URLs captured during sync, but the base path (before `?`) is stable
 * for the same image.
 */
function findCacheEntry(url: string, cache: ImageCache): ImageCacheEntry | undefined {
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

export interface RehypeNotionImagesOptions {
  cacheFile?: string;
}

/**
 * Rehype plugin factory.
 */
export function rehypeNotionImages(options: RehypeNotionImagesOptions = {}) {
  const cacheFile = options.cacheFile ?? '.image-cache.json';
  const cache = loadImageCache(cacheFile);
  const cacheSize = Object.keys(cache).length;

  if (cacheSize === 0) {
    // No cache — return a no-op transformer
    return () => {};
  }

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return;

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
    });
  };
}

export default rehypeNotionImages;
