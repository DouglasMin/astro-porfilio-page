/**
 * Notion Image Sync Script
 *
 * Downloads images from Notion blog posts, caps them at 2400px wide,
 * converts to WebP, and saves locally. Images stay near full resolution so
 * diagrams remain legible on retina screens and in the zoom viewer.
 * Uses a hash-based cache to skip unchanged images on subsequent runs.
 *
 * Videos uploaded to Notion are converted to web-safe MP4 by notion-videos.ts
 * and listed in `.video-cache.json` for the rehype plugin.
 *
 * Usage: tsx scripts/sync-notion-images.ts
 */

import 'dotenv/config';
import { Client } from '@notionhq/client';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { syncVideo, toPublicUrl, type SyncedVideo } from './notion-videos';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageCacheEntry {
  notionUrl: string;
  localPath: string;
  hash: string;
  width?: number;
  height?: number;
  /** Matches PROCESSING_VERSION when the file was produced with current settings. */
  processingVersion?: number;
  lastSynced: string;
}

/** Bump whenever processImage output changes so cached images are regenerated. */
const PROCESSING_VERSION = 2;

interface ImageCache {
  [notionUrl: string]: ImageCacheEntry;
}

interface VideoCacheEntry extends SyncedVideo {
  notionUrl: string;
  lastSynced: string;
}

interface VideoCache {
  [notionUrl: string]: VideoCacheEntry;
}

interface ImageSyncConfig {
  notionToken: string;
  databaseId: string;
  outputDir: string;
  maxWidth: number;
  cacheFile: string;
  videoOutputDir: string;
  videoCacheFile: string;
}

interface MediaUrls {
  images: string[];
  videos: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadCache<T extends object>(cacheFile: string): T {
  try {
    if (fs.existsSync(cacheFile)) {
      const raw = fs.readFileSync(cacheFile, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch {
    console.warn(`⚠️  ${cacheFile} corrupted — starting fresh.`);
  }
  return {} as T;
}

function saveCache(cacheFile: string, cache: object): void {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
}

function md5(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/** Notion signs file URLs per request; the path before `?` is stable per image. */
function stripQuery(url: string): string {
  return url.split('?')[0];
}

/**
 * Derive a stable, filesystem-safe file stem (no extension) from a URL.
 * Notion names most pasted images `image.png`, so the last path segment is
 * prefixed with a short hash of the full path to keep filenames unique.
 */
function fileStemFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    const base = last.replace(/\.[^.]+$/, '');
    if (base.length > 0 && base.length <= 120) {
      const pathHash = md5(Buffer.from(parsed.pathname)).slice(0, 8);
      return `${pathHash}-${base}`;
    }
  } catch {
    // fall through
  }
  return md5(Buffer.from(stripQuery(url)));
}

/** Images are always saved as WebP. */
function filenameFromUrl(url: string): string {
  return `${fileStemFromUrl(url)}.webp`;
}

// ---------------------------------------------------------------------------
// Notion helpers
// ---------------------------------------------------------------------------

async function getPublishedPages(notion: Client, databaseId: string) {
  const pages: Array<{ id: string }> = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Published',
        checkbox: { equals: true },
      },
      start_cursor: cursor,
    });

    for (const page of response.results) {
      pages.push({ id: page.id });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

/**
 * Recursively fetch all blocks for a page and extract image and uploaded-video URLs.
 * External videos (YouTube links and the like) are not files, so they are skipped.
 */
async function extractMediaUrls(
  notion: Client,
  blockId: string,
): Promise<MediaUrls> {
  const urls: string[] = [];
  const videos: string[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    });

    for (const block of response.results) {
      const b = block as any;

      // Image block
      if (b.type === 'image') {
        const img = b.image;
        if (img?.type === 'file') {
          urls.push(img.file.url);
        } else if (img?.type === 'external') {
          urls.push(img.external.url);
        }
      }

      // Video block uploaded directly to Notion
      if (b.type === 'video' && b.video?.type === 'file') {
        videos.push(b.video.file.url);
      }

      // Recurse into blocks that have children
      if (b.has_children) {
        const child = await extractMediaUrls(notion, b.id);
        urls.push(...child.images);
        videos.push(...child.videos);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return { images: urls, videos };
}

/**
 * Convert a page's uploaded videos and record them in the video cache.
 * Returns how many were converted, reused from disk, and failed.
 */
async function syncPageVideos(
  videoUrls: string[],
  pageDir: string,
  videoCache: VideoCache,
): Promise<{ converted: number; reused: number; failed: number }> {
  const stats = { converted: 0, reused: 0, failed: 0 };

  for (const url of videoUrls) {
    try {
      const { video, converted } = await syncVideo(url, pageDir, fileStemFromUrl(url));
      videoCache[stripQuery(url)] = { notionUrl: url, ...video, lastSynced: new Date().toISOString() };
      if (converted) {
        stats.converted++;
        console.log(`   🎬 ${path.basename(video.localPath)} (${video.width}x${video.height})`);
      } else {
        stats.reused++;
      }
    } catch (err) {
      console.warn(`   ⚠️  Failed to process video: ${err}`);
      stats.failed++;
    }
  }

  return stats;
}

/**
 * Drop videos that no published post uses any more (replaced or deleted
 * uploads, outputs of an older VIDEO_PROCESSING_VERSION) so they stop being
 * deployed and cached. Returns the cache without their entries.
 */
function pruneStaleVideos(outputDir: string, videoCache: VideoCache, seenKeys: Set<string>): VideoCache {
  const active: VideoCache = Object.fromEntries(
    Object.entries(videoCache).filter(([key]) => seenKeys.has(key)),
  );
  if (!fs.existsSync(outputDir)) return active;

  const keep = new Set(Object.values(active).flatMap((entry) => [entry.localPath, entry.posterPath]));
  for (const relative of fs.readdirSync(outputDir, { recursive: true, encoding: 'utf-8' })) {
    const file = path.join(outputDir, relative);
    if (fs.statSync(file).isFile() && !keep.has(toPublicUrl(file))) {
      fs.rmSync(file);
      console.log(`   🧹 Removed stale video file ${relative}`);
    }
  }
  for (const dir of fs.readdirSync(outputDir)) {
    const pageDir = path.join(outputDir, dir);
    if (fs.statSync(pageDir).isDirectory() && fs.readdirSync(pageDir).length === 0) {
      fs.rmdirSync(pageDir);
    }
  }
  return active;
}

// ---------------------------------------------------------------------------
// Image processing
// ---------------------------------------------------------------------------

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Photos (JPEG) compress well with lossy WebP. Everything else is usually a
 * screenshot or diagram, where lossy artifacts blur small text and thin
 * lines, so it gets near-lossless encoding instead.
 */
async function processImage(
  buffer: Buffer,
  maxWidth: number,
): Promise<{ data: Buffer; width: number; height: number }> {
  const image = sharp(buffer);
  const { format } = await image.metadata();

  const webpOptions =
    format === 'jpeg'
      ? { quality: 85 }
      : { nearLossless: true, quality: 60 };

  const { data, info } = await image
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp(webpOptions)
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || !databaseId) {
    console.error('❌ NOTION_TOKEN and NOTION_DATABASE_ID must be set in .env');
    process.exit(1);
  }

  const config: ImageSyncConfig = {
    notionToken,
    databaseId,
    outputDir: 'public/images/blog',
    maxWidth: 2400,
    cacheFile: '.image-cache.json',
    videoOutputDir: 'public/videos/blog',
    videoCacheFile: '.video-cache.json',
  };

  const notion = new Client({ auth: config.notionToken });
  const cache = loadCache<ImageCache>(config.cacheFile);
  const videoCache = loadCache<VideoCache>(config.videoCacheFile);

  console.log('🔍 Querying Notion for published posts…');
  const pages = await getPublishedPages(notion, config.databaseId);
  console.log(`   Found ${pages.length} published post(s).`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let videosConverted = 0;
  let videosReused = 0;
  const seenVideoKeys = new Set<string>();

  for (const page of pages) {
    const pageId = page.id.replace(/-/g, '');
    console.log(`\n📄 Processing page ${pageId}…`);

    let media: MediaUrls;
    try {
      media = await extractMediaUrls(notion, page.id);
    } catch (err) {
      console.warn(`   ⚠️  Failed to fetch blocks for page ${pageId}: ${err}`);
      failed++;
      continue;
    }

    media.videos.forEach((url) => seenVideoKeys.add(stripQuery(url)));
    if (media.videos.length > 0) {
      console.log(`   Found ${media.videos.length} video(s).`);
      const videoStats = await syncPageVideos(media.videos, path.join(config.videoOutputDir, pageId), videoCache);
      videosConverted += videoStats.converted;
      videosReused += videoStats.reused;
      failed += videoStats.failed;
    }

    const imageUrls = media.images;
    if (imageUrls.length === 0) {
      console.log('   No images found.');
      continue;
    }

    console.log(`   Found ${imageUrls.length} image(s).`);

    const pageDir = path.join(config.outputDir, pageId);
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    for (const url of imageUrls) {
      try {
        // Download the raw image to compute its hash
        const rawBuffer = await downloadImage(url);
        const hash = md5(rawBuffer);

        const cacheKey = stripQuery(url);

        // Check cache
        const cached = cache[cacheKey];
        if (
          cached &&
          cached.hash === hash &&
          cached.processingVersion === PROCESSING_VERSION
        ) {
          skipped++;
          continue;
        }

        // Process and save
        const { data, width, height } = await processImage(rawBuffer, config.maxWidth);
        const filename = filenameFromUrl(url);
        const localPath = path.join(pageDir, filename);

        fs.writeFileSync(localPath, data);

        cache[cacheKey] = {
          notionUrl: url,
          localPath: `/${localPath.replace(/\\/g, '/')}`.replace(/^\/public/, ''),
          hash,
          width,
          height,
          processingVersion: PROCESSING_VERSION,
          lastSynced: new Date().toISOString(),
        };

        downloaded++;
        console.log(`   ✅ ${filename}`);
      } catch (err) {
        console.warn(`   ⚠️  Failed to process image: ${err}`);
        failed++;
      }
    }
  }

  saveCache(config.cacheFile, cache);
  // Only a failure-free run has seen every published video, so only then is pruning safe
  saveCache(
    config.videoCacheFile,
    failed === 0 ? pruneStaleVideos(config.videoOutputDir, videoCache, seenVideoKeys) : videoCache,
  );

  console.log('\n📊 Summary:');
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Skipped (cached): ${skipped}`);
  console.log(`   Videos converted: ${videosConverted}`);
  console.log(`   Videos reused: ${videosReused}`);
  console.log(`   Failed: ${failed}`);
  console.log('✨ Image sync complete.');
}

main().catch((err) => {
  console.error('❌ Image sync failed:', err);
  process.exit(1);
});
