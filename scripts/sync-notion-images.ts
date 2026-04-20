/**
 * Notion Image Sync Script
 *
 * Downloads images from Notion blog posts, resizes them to 720px max width,
 * converts to WebP, and saves locally. Uses a hash-based cache to skip
 * unchanged images on subsequent runs.
 *
 * Usage: tsx scripts/sync-notion-images.ts
 */

import 'dotenv/config';
import { Client } from '@notionhq/client';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageCacheEntry {
  notionUrl: string;
  localPath: string;
  hash: string;
  lastSynced: string;
}

interface ImageCache {
  [notionUrl: string]: ImageCacheEntry;
}

interface ImageSyncConfig {
  notionToken: string;
  databaseId: string;
  outputDir: string;
  maxWidth: number;
  cacheFile: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadCache(cacheFile: string): ImageCache {
  try {
    if (fs.existsSync(cacheFile)) {
      const raw = fs.readFileSync(cacheFile, 'utf-8');
      return JSON.parse(raw) as ImageCache;
    }
  } catch {
    console.warn('⚠️  Cache file corrupted — starting fresh.');
  }
  return {};
}

function saveCache(cacheFile: string, cache: ImageCache): void {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
}

function md5(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Derive a stable, filesystem-safe filename from a URL.
 * Uses the last path segment (without query params) or falls back to an MD5 hash.
 */
function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    // Strip extension — we always save as .webp
    const base = last.replace(/\.[^.]+$/, '');
    if (base.length > 0 && base.length <= 120) {
      return `${base}.webp`;
    }
  } catch {
    // fall through
  }
  return `${md5(Buffer.from(url))}.webp`;
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
 * Recursively fetch all blocks for a page and extract image URLs.
 */
async function extractImageUrls(
  notion: Client,
  blockId: string,
): Promise<string[]> {
  const urls: string[] = [];
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

      // Recurse into blocks that have children
      if (b.has_children) {
        const childUrls = await extractImageUrls(notion, b.id);
        urls.push(...childUrls);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return urls;
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

async function processImage(
  buffer: Buffer,
  maxWidth: number,
): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (metadata.width && metadata.width > maxWidth) {
    return image
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  }

  return image.webp({ quality: 80 }).toBuffer();
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
    maxWidth: 720,
    cacheFile: '.image-cache.json',
  };

  const notion = new Client({ auth: config.notionToken });
  const cache = loadCache(config.cacheFile);

  console.log('🔍 Querying Notion for published posts…');
  const pages = await getPublishedPages(notion, config.databaseId);
  console.log(`   Found ${pages.length} published post(s).`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const page of pages) {
    const pageId = page.id.replace(/-/g, '');
    console.log(`\n📄 Processing page ${pageId}…`);

    let imageUrls: string[];
    try {
      imageUrls = await extractImageUrls(notion, page.id);
    } catch (err) {
      console.warn(`   ⚠️  Failed to fetch blocks for page ${pageId}: ${err}`);
      failed++;
      continue;
    }

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

        // Check cache
        if (cache[url] && cache[url].hash === hash) {
          skipped++;
          continue;
        }

        // Process and save
        const webpBuffer = await processImage(rawBuffer, config.maxWidth);
        const filename = filenameFromUrl(url);
        const localPath = path.join(pageDir, filename);

        fs.writeFileSync(localPath, webpBuffer);

        cache[url] = {
          notionUrl: url,
          localPath: `/${localPath.replace(/\\/g, '/')}`.replace(/^\/public/, ''),
          hash,
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

  console.log('\n📊 Summary:');
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Skipped (cached): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log('✨ Image sync complete.');
}

main().catch((err) => {
  console.error('❌ Image sync failed:', err);
  process.exit(1);
});
