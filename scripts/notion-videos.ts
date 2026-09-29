/**
 * Video half of the Notion media sync.
 *
 * Converts uploads (iPhone HEVC .mov, QuickTime screen recordings, …) into a
 * web-safe H.264 MP4 plus a WebP poster of the first frame, so every browser
 * can play them inline.
 *
 * Outputs are named after the source file and VIDEO_PROCESSING_VERSION and are
 * reused whenever both exist, so a converted video is never downloaded again.
 * That check only needs public/videos, which is what CI caches between runs.
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const run = promisify(execFile);

/** Bump whenever the ffmpeg settings change so every video is re-encoded. */
export const VIDEO_PROCESSING_VERSION = 1;

/** Longest output side: keeps UI text in screen recordings sharp at blog width. */
const MAX_DIMENSION = 1920;
const MAX_FPS = 60;
const FFMPEG_MAX_BUFFER = 64 * 1024 * 1024;
const POSTER_QUALITY = 82;

export interface SyncedVideo {
  /** Public URL of the MP4, e.g. /videos/blog/<pageId>/<name>.v1.mp4 */
  localPath: string;
  /** Public URL of the first-frame WebP poster */
  posterPath: string;
  width: number;
  height: number;
}

function ffmpeg(): string {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static has no binary for this platform');
  }
  return ffmpegPath;
}

export function toPublicUrl(file: string): string {
  return `/${path.relative('public', file).split(path.sep).join('/')}`;
}

/** Stream to disk: uploads can be hundreds of MB, too big to buffer. */
async function downloadToFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body as WebReadableStream), fs.createWriteStream(dest));
}

async function transcodeToMp4(input: string, output: string): Promise<void> {
  await run(
    ffmpeg(),
    [
      '-nostdin', '-y', '-loglevel', 'error',
      '-i', input,
      // First video stream, plus audio only if there is any
      '-map', '0:v:0', '-map', '0:a:0?',
      // Fit inside MAX_DIMENSION² without upscaling; H.264 needs even sizes
      '-vf', `scale=w='min(${MAX_DIMENSION},iw)':h='min(${MAX_DIMENSION},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
      '-fpsmax', String(MAX_FPS),
      // 8-bit 4:2:0 High profile plays everywhere (HEVC and 10-bit do not)
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '128k',
      // Drop phone metadata such as GPS location
      '-map_metadata', '-1', '-map_metadata:s:v', '-1', '-map_metadata:s:a', '-1',
      // Put the index first so playback starts before the whole file arrives
      '-movflags', '+faststart',
      '-f', 'mp4', output,
    ],
    { maxBuffer: FFMPEG_MAX_BUFFER },
  );
}

async function extractFirstFramePng(video: string): Promise<Buffer> {
  const { stdout } = await run(
    ffmpeg(),
    ['-nostdin', '-loglevel', 'error', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', 'pipe:1'],
    { encoding: 'buffer', maxBuffer: FFMPEG_MAX_BUFFER },
  );
  return stdout;
}

/**
 * Ensure `<outputDir>/<stem>.v<N>.mp4` and its `.webp` poster exist,
 * downloading and converting the Notion upload at `url` only when they do not.
 */
export async function syncVideo(
  url: string,
  outputDir: string,
  stem: string,
): Promise<{ video: SyncedVideo; converted: boolean }> {
  const base = path.join(outputDir, `${stem}.v${VIDEO_PROCESSING_VERSION}`);
  const videoFile = `${base}.mp4`;
  const posterFile = `${base}.webp`;
  const converted = !fs.existsSync(videoFile) || !fs.existsSync(posterFile);

  if (converted) {
    fs.mkdirSync(outputDir, { recursive: true });
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notion-video-'));
    const partialFile = `${videoFile}.partial`;
    try {
      const source = path.join(workDir, 'source');
      await downloadToFile(url, source);
      await transcodeToMp4(source, partialFile);
      const poster = await sharp(await extractFirstFramePng(partialFile)).webp({ quality: POSTER_QUALITY }).toBuffer();
      fs.writeFileSync(posterFile, poster);
      // Publish the MP4 last, atomically: an interrupted run never leaves both files behind
      fs.renameSync(partialFile, videoFile);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
      fs.rmSync(partialFile, { force: true });
    }
  }

  const { width, height } = await sharp(posterFile).metadata();
  if (!width || !height) {
    throw new Error(`Could not read poster dimensions for ${posterFile}`);
  }

  return {
    video: { localPath: toPublicUrl(videoFile), posterPath: toPublicUrl(posterFile), width, height },
    converted,
  };
}
