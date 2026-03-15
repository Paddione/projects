import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { videos } from '@shared/schema';
import { logger } from './logger';
import { MOVIE_EXTENSIONS, extractMovieMetadata, detectQualityCategories, generateMovieThumbnail } from '../handlers/movie-handler';

/**
 * Run all startup tasks for the movies library.
 *
 * Layout: flat — video files live directly in MOVIES_DIR/,
 * thumbnails and sprites in MOVIES_DIR/Thumbnails/.
 *
 * 1. Ensure 1_inbox and Thumbnails directories exist
 * 2. Drain inbox: move files from 1_inbox/ to MOVIES_DIR/
 * 3. Generate missing thumbnails/sprites for any video in MOVIES_DIR/
 * 4. Auto-index all videos (with thumbnails) into DB
 */
export async function runStartupTasks(db: any): Promise<void> {
  const MOVIES_DIR = process.env.MOVIES_DIR || path.join(process.cwd(), 'media', 'movies');

  try {
    await fs.access(MOVIES_DIR);
  } catch {
    logger.warn('[StartupTasks] MOVIES_DIR not accessible, skipping startup tasks', { directory: MOVIES_DIR });
    return;
  }

  // 1. Ensure required directories exist
  const thumbsDir = path.join(MOVIES_DIR, 'Thumbnails');
  const inboxDir = path.join(MOVIES_DIR, '1_inbox');
  await fs.mkdir(thumbsDir, { recursive: true }).catch(() => {});
  await fs.mkdir(inboxDir, { recursive: true }).catch(() => {});
  logger.info('[StartupTasks] Directories ensured', { moviesDir: MOVIES_DIR });

  // 2. Drain inbox → move files to MOVIES_DIR root
  await drainInbox(MOVIES_DIR);

  // 3. Generate missing thumbnails for any video file in MOVIES_DIR
  await generateMissingThumbnails(MOVIES_DIR);

  // 4. Index all videos with thumbnails into DB
  await autoIndexLibrary(db, MOVIES_DIR);
}

// Track filenames that failed stat (encoding issues on SMB) — warn only once
const _failedStatNames = new Set<string>();

/**
 * Move all video files from MOVIES_DIR/1_inbox/ into MOVIES_DIR/.
 * Exported so the movie watcher can call it on each scan cycle too.
 */
export async function drainInbox(moviesDir: string): Promise<number> {
  const inboxDir = path.join(moviesDir, '1_inbox');

  // Use raw readdir (not withFileTypes) to get exact filenames as the filesystem reports them,
  // then stat individually. This avoids encoding mismatches between readdir and rename on SMB.
  let filenames: string[];
  try {
    filenames = await fs.readdir(inboxDir);
  } catch {
    return 0;
  }

  const videoFilenames = filenames.filter(
    (name) => MOVIE_EXTENSIONS.includes(path.extname(name).toLowerCase()),
  );

  if (videoFilenames.length === 0) return 0;

  let moved = 0;
  for (const name of videoFilenames) {
    const src = path.join(inboxDir, name);
    const dest = path.join(moviesDir, name);

    // Verify it's actually a file (not a directory)
    try {
      const stat = await fs.stat(src);
      if (!stat.isFile()) continue;
    } catch {
      // Can't stat — skip (encoding issue or file disappeared). Warn once.
      if (!_failedStatNames.has(name)) {
        _failedStatNames.add(name);
        logger.warn(`[StartupTasks] Inbox skip: cannot stat ${name} (SMB encoding issue? will not retry)`);
      }
      continue;
    }

    // Skip if a file with the same name already exists in root
    try {
      await fs.access(dest);
      logger.warn(`[StartupTasks] Inbox skip: ${name} already exists in movies root`);
      continue;
    } catch { /* dest doesn't exist — good */ }

    try {
      await fs.rename(src, dest);
      moved++;
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        try {
          await fs.copyFile(src, dest);
          await fs.unlink(src);
          moved++;
        } catch (copyErr: any) {
          logger.warn(`[StartupTasks] Inbox copy failed: ${name}`, { error: copyErr.message });
        }
      } else {
        logger.warn(`[StartupTasks] Inbox move failed: ${name}`, { error: err.message });
      }
    }
  }

  if (moved > 0) {
    logger.info(`[StartupTasks] Inbox drained: ${moved} files moved to movies root`);
  }
  return moved;
}

/**
 * For each video file directly in MOVIES_DIR/ that is missing a
 * thumbnail or sprite in MOVIES_DIR/Thumbnails/, generate them.
 */
async function generateMissingThumbnails(moviesDir: string): Promise<void> {
  const thumbsDir = path.join(moviesDir, 'Thumbnails');

  let entries;
  try {
    entries = await fs.readdir(moviesDir, { withFileTypes: true });
  } catch {
    return;
  }

  const videoFiles = entries.filter(
    (e) => e.isFile() && MOVIE_EXTENSIONS.includes(path.extname(e.name).toLowerCase()),
  );

  let generated = 0;
  let failed = 0;

  for (const entry of videoFiles) {
    const baseName = path.basename(entry.name, path.extname(entry.name));
    const thumbPath = path.join(thumbsDir, `${baseName}_thumb.jpg`);
    const spritePath = path.join(thumbsDir, `${baseName}_sprite.jpg`);

    let hasThumb = false;
    let hasSprite = false;
    try { await fs.access(thumbPath); hasThumb = true; } catch { /* */ }
    try { await fs.access(spritePath); hasSprite = true; } catch { /* */ }

    if (hasThumb && hasSprite) continue;

    const videoPath = path.join(moviesDir, entry.name);
    try {
      await generateMovieThumbnail(videoPath, thumbsDir);
      generated++;
      logger.info(`[StartupTasks] Generated thumbnails for ${entry.name}`);
    } catch (err: any) {
      failed++;
      logger.warn(`[StartupTasks] Thumbnail generation failed for ${entry.name}`, { error: err.message });
    }
  }

  if (generated > 0 || failed > 0) {
    logger.info('[StartupTasks] Thumbnail generation complete', { generated, failed });
  }
}

/**
 * Index all video files in MOVIES_DIR/ that have thumbnails into the DB.
 * Flat layout: videos at root level, thumbnails in Thumbnails/ subfolder.
 */
async function autoIndexLibrary(db: any, moviesDir: string): Promise<void> {
  if (!db) return;

  const thumbsDir = path.join(moviesDir, 'Thumbnails');

  let entries;
  try {
    entries = await fs.readdir(moviesDir, { withFileTypes: true });
  } catch {
    return;
  }

  const videoFiles = entries.filter(
    (e) => e.isFile() && MOVIE_EXTENSIONS.includes(path.extname(e.name).toLowerCase()),
  );

  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of videoFiles) {
    try {
      const baseName = path.basename(entry.name, path.extname(entry.name));
      const thumbPath = path.join(thumbsDir, `${baseName}_thumb.jpg`);
      const spritePath = path.join(thumbsDir, `${baseName}_sprite.jpg`);

      // Require both thumbnail and sprite
      let hasThumb = false;
      let hasSprite = false;
      try { await fs.access(thumbPath); hasThumb = true; } catch { /* */ }
      try { await fs.access(spritePath); hasSprite = true; } catch { /* */ }

      if (!hasThumb || !hasSprite) {
        skipped++;
        continue;
      }

      // Deterministic ID from filename (flat layout — file is at root)
      const id = crypto.createHash('sha256').update('movies:' + entry.name).digest('hex').slice(0, 36);

      // Skip if already indexed
      const existing = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, id)).limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const videoPath = path.join(moviesDir, entry.name);
      const stat = await fs.stat(videoPath);
      const thumbUrl = `/media/movies/Thumbnails/${encodeURIComponent(baseName)}_thumb.jpg`;

      // Extract metadata via ffprobe
      let metadata = { duration: 0, width: 0, height: 0, bitrate: 0, codec: '', fps: 0, aspectRatio: '' };
      try {
        const probed = await extractMovieMetadata(videoPath);
        metadata = {
          duration: probed.duration || 0,
          width: probed.width || 0,
          height: probed.height || 0,
          bitrate: probed.bitrate || 0,
          codec: probed.codec || '',
          fps: probed.fps || 0,
          aspectRatio: probed.aspectRatio || '',
        };
      } catch (probeErr: any) {
        logger.warn(`[StartupTasks] ffprobe failed for ${entry.name}`, { error: probeErr.message });
      }

      const qualities = detectQualityCategories(metadata);

      await db
        .insert(videos)
        .values({
          id,
          filename: entry.name,
          displayName: baseName,
          path: `movies/${entry.name}`,
          size: stat.size,
          lastModified: stat.mtime,
          metadata,
          categories: {
            age: [] as string[],
            physical: [] as string[],
            ethnicity: [] as string[],
            relationship: [] as string[],
            acts: [] as string[],
            setting: [] as string[],
            quality: qualities,
            performer: [] as string[],
          },
          customCategories: {},
          thumbnail: { generated: true, dataUrl: thumbUrl, timestamp: new Date().toISOString() },
          rootKey: 'movies',
          processingStatus: 'completed',
        })
        .onConflictDoUpdate({
          target: videos.id,
          set: {
            filename: entry.name,
            displayName: baseName,
            path: `movies/${entry.name}`,
            size: stat.size,
            lastModified: stat.mtime,
            metadata,
            thumbnail: { generated: true, dataUrl: thumbUrl, timestamp: new Date().toISOString() },
            processingStatus: 'completed',
          },
        });

      indexed++;
    } catch (err: any) {
      errors++;
      logger.warn(`[StartupTasks] Failed to index ${entry.name}`, { error: err.message });
    }
  }

  if (indexed > 0 || errors > 0) {
    logger.info('[StartupTasks] Auto-index complete', { indexed, skipped, errors });
  } else {
    logger.info('[StartupTasks] Auto-index: library up to date', { skipped });
  }
}
