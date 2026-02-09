import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { eq, and } from 'drizzle-orm';
import { videos, scanState } from '@shared/schema';
import { logger } from '../lib/logger';
import type { JobContext } from '../lib/enhanced-job-queue';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Supported movie file extensions
export const MOVIE_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.m4v'];

// Regex patterns to extract title and year from filenames
const TITLE_YEAR_PATTERNS = [
  // Common patterns: Some.Movie.2024.1080p.BluRay.mp4
  /^(.+?)[\.\s]*(19\d{2}|20\d{2})[\.\s]/i,
  // Patterns with brackets: Some Movie [2024] 1080p.mp4
  /^(.+?)[\s\[]*\((19\d{2}|20\d{2})\)[\]\s]*/i,
  /^(.+?)[\s]*\[(19\d{2}|20\d{2})\][\s]*/i,
  // Pattern with dash: Some Movie - 2024 - 1080p.mp4
  /^(.+?)\s*-\s*(19\d{2}|20\d{2})\s*-/i,
];

export interface MovieJobPayload {
  inputPath: string;
  movieId?: string;
  rootKey?: string;
  autoOrganize?: boolean;
}

export interface MovieMetadata {
  title: string;
  year?: number;
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  fps: number;
  aspectRatio: string;
  fileSize: number;
}

interface FFprobeResult {
  streams: Array<{
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    avg_frame_rate?: string;
  }>;
  format: {
    duration: string;
    bit_rate: string;
    size: string;
  };
}

/**
 * Parse title and year from a movie filename
 */
function parseMovieFilename(filename: string): { title: string; year?: number } {
  const baseName = path.basename(filename, path.extname(filename));

  for (const pattern of TITLE_YEAR_PATTERNS) {
    const match = baseName.match(pattern);
    if (match) {
      const rawTitle = match[1]
        .replace(/[\._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const year = parseInt(match[2], 10);

      return {
        title: rawTitle,
        year: year >= 1900 && year <= new Date().getFullYear() + 1 ? year : undefined,
      };
    }
  }

  // Fallback: just clean up the filename
  const cleanTitle = baseName
    .replace(/[\._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { title: cleanTitle };
}

/**
 * Generate organized folder path for a movie
 * Format: Title (Year)/ or Title/ if no year
 */
function generateOrganizedPath(title: string, year?: number): string {
  const sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '').trim();
  if (year) {
    return `${sanitizedTitle} (${year})`;
  }
  return sanitizedTitle;
}

/**
 * Extract metadata from a movie file using ffprobe
 */
async function extractMovieMetadata(filePath: string): Promise<Omit<MovieMetadata, 'title' | 'year'>> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-select_streams', 'v:0',
      filePath,
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }

      try {
        const data: FFprobeResult = JSON.parse(stdout);
        const videoStream = data.streams.find((s) => s.codec_type === 'video');

        if (!videoStream) {
          return reject(new Error('No video stream found'));
        }

        // Parse fps
        const fpsRatio = videoStream.r_frame_rate || videoStream.avg_frame_rate || '30/1';
        const [num, den] = fpsRatio.split('/').map(Number);
        const fps = den ? num / den : num;

        // Get file size
        const stats = await fs.stat(filePath);

        // Calculate aspect ratio
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height) || 1;
        const aspectRatio = `${width / divisor}:${height / divisor}`;

        resolve({
          duration: parseFloat(data.format.duration) || 0,
          width,
          height,
          bitrate: parseInt(data.format.bit_rate) || 0,
          codec: videoStream.codec_name || 'unknown',
          fps: Math.round(fps * 100) / 100,
          aspectRatio,
          fileSize: stats.size,
        });
      } catch (error: any) {
        reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn ffprobe: ${error.message}`));
    });
  });
}

/**
 * Calculate file hash (first 64KB + size)
 */
async function calculateFileHash(filePath: string): Promise<string> {
  const stats = await fs.stat(filePath);
  const handle = await fs.open(filePath, 'r');
  const buffer = Buffer.alloc(Math.min(65536, stats.size));
  await handle.read(buffer, 0, buffer.length, 0);
  await handle.close();

  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  hash.update(stats.size.toString());
  return hash.digest('hex');
}

/**
 * Generate thumbnail for a movie file
 */
export async function generateMovieThumbnail(
  inputPath: string,
  outputDir: string,
): Promise<{ thumb: string; sprite: string }> {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const thumbOut = path.join(outputDir, `${baseName}_thumb.jpg`);
  const spriteOut = path.join(outputDir, `${baseName}_sprite.jpg`);

  // Get duration first
  const durationResult = await new Promise<number>((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ];
    const proc = spawn('ffprobe', args);
    let stdout = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        const sec = parseFloat(stdout);
        resolve(Number.isFinite(sec) && sec > 0 ? sec : 0);
      } else {
        reject(new Error('Failed to get duration'));
      }
    });
    proc.on('error', reject);
  });

  if (durationResult === 0) {
    throw new Error('Invalid video duration');
  }

  // Generate thumbnail at 50%
  await new Promise<void>((resolve, reject) => {
    const thumbArgs = [
      '-hide_banner', '-loglevel', 'error',
      '-y',
      '-ss', (durationResult * 0.5).toFixed(2),
      '-i', inputPath,
      '-frames:v', '1',
      '-q:v', '2',
      thumbOut,
    ];

    const proc = spawn('ffmpeg', thumbArgs);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg thumbnail failed with code ${code}`));
    });
    proc.on('error', reject);
  });

  // Generate sprite (25 frames in a row)
  const fps = 25 / durationResult;
  await new Promise<void>((resolve, reject) => {
    const spriteArgs = [
      '-hide_banner', '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-vf', `fps=${fps},scale=160:-1,tile=25x1`,
      '-frames:v', '1',
      '-q:v', '2',
      spriteOut,
    ];

    const proc = spawn('ffmpeg', spriteArgs);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg sprite failed with code ${code}`));
    });
    proc.on('error', reject);
  });

  return { thumb: thumbOut, sprite: spriteOut };
}

/**
 * Main Movie Processing Handler
 *
 * 1. Parse title and year from filename
 * 2. Extract metadata with ffprobe
 * 3. Optionally organize into Title (Year)/ folder
 * 4. Generate thumbnails
 * 5. Store in database
 */
export async function handleMovieProcessing(
  data: MovieJobPayload,
  context: JobContext,
  db: any,
) {
  const { inputPath, movieId, rootKey, autoOrganize = true } = data;
  const MOVIES_DIR = process.env.MOVIES_DIR || path.join(process.cwd(), 'media', 'movies');

  logger.info(`[MovieHandler] Processing movie: ${inputPath}`, { movieId, rootKey });

  try {
    // 1. Verify file exists
    await fs.access(inputPath);
    const stats = await fs.stat(inputPath);

    // 2. Parse title and year from filename
    const { title, year } = parseMovieFilename(inputPath);
    logger.info(`[MovieHandler] Parsed: ${title} (${year || 'no year'})`, { inputPath });

    // 3. Extract metadata
    const metadata = await extractMovieMetadata(inputPath);
    logger.info(`[MovieHandler] Metadata extracted: ${metadata.duration}s, ${metadata.width}x${metadata.height}`, { inputPath });

    // 4. Calculate file hash
    const fileHash = await calculateFileHash(inputPath);

    // 5. Organize file if autoOrganize is enabled
    let finalPath = inputPath;
    let relativePath = path.relative(MOVIES_DIR, inputPath);

    if (autoOrganize) {
      const currentDir = path.dirname(inputPath);
      const filename = path.basename(inputPath);
      const organizedFolder = generateOrganizedPath(title, year);
      const targetDir = path.join(MOVIES_DIR, organizedFolder);
      const targetPath = path.join(targetDir, filename);

      // Only move if not already in the right location
      if (path.dirname(inputPath) !== targetDir) {
        // Create target directory
        await fs.mkdir(targetDir, { recursive: true });

        // Move the file
        try {
          await fs.rename(inputPath, targetPath);
          finalPath = targetPath;
          relativePath = path.relative(MOVIES_DIR, targetPath);
          logger.info(`[MovieHandler] Organized: ${inputPath} -> ${targetPath}`);
        } catch (moveError: any) {
          // If rename fails (cross-device), try copy + delete
          if (moveError.code === 'EXDEV') {
            await fs.copyFile(inputPath, targetPath);
            await fs.unlink(inputPath);
            finalPath = targetPath;
            relativePath = path.relative(MOVIES_DIR, targetPath);
            logger.info(`[MovieHandler] Organized (copy): ${inputPath} -> ${targetPath}`);
          } else {
            throw moveError;
          }
        }
      }
    }

    // 6. Create Thumbnails subfolder and generate thumbnails
    const movieDir = path.dirname(finalPath);
    const thumbsDir = path.join(movieDir, 'Thumbnails');
    await fs.mkdir(thumbsDir, { recursive: true });

    const thumbnails = await generateMovieThumbnail(finalPath, thumbsDir);
    logger.info(`[MovieHandler] Thumbnails generated: ${thumbnails.thumb}, ${thumbnails.sprite}`);

    // 7. Store in database
    const id = movieId || uuidv4();
    if (db) {
      const baseName = path.basename(finalPath);
      await db
        .insert(videos)
        .values({
          id,
          filename: baseName,
          displayName: title + (year ? ` (${year})` : ''),
          path: relativePath,
          size: stats.size,
          lastModified: stats.mtime,
          fileHash,
          bitrate: metadata.bitrate,
          codec: metadata.codec,
          fps: metadata.fps,
          aspectRatio: metadata.aspectRatio,
          categories: {
            title,
            year: year?.toString() || '',
          },
          customCategories: {},
          metadata: {
            title,
            year,
            ...metadata,
            thumbnailPath: path.relative(MOVIES_DIR, thumbnails.thumb),
            spritePath: path.relative(MOVIES_DIR, thumbnails.sprite),
          },
          processingStatus: 'completed',
          metadataExtractedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: videos.fileHash,
          set: {
            filename: baseName,
            displayName: title + (year ? ` (${year})` : ''),
            path: relativePath,
            processingStatus: 'completed',
          },
        });

      // Update scan state if rootKey provided
      if (rootKey) {
        await db
          .insert(scanState)
          .values({
            rootKey,
            relativePath,
            fileHash,
            metadataExtracted: 'true',
            thumbnailGenerated: 'true',
            spriteGenerated: 'true',
            lastProcessedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [scanState.rootKey, scanState.relativePath],
            set: {
              fileHash,
              metadataExtracted: 'true',
              thumbnailGenerated: 'true',
              spriteGenerated: 'true',
              lastProcessedAt: new Date(),
            },
          });
      }
    }

    logger.info(`[MovieHandler] Successfully processed movie: ${title}`, {
      id,
      path: finalPath,
      duration: metadata.duration,
    });

    return {
      status: 'completed',
      movieId: id,
      title,
      year,
      path: finalPath,
      thumbnails,
      metadata,
    };
  } catch (error: any) {
    logger.error(`[MovieHandler] Failed to process movie: ${inputPath}`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Scan movies directory and return all movie files
 */
export async function scanMoviesDirectory(
  directory?: string,
  recursive = true,
  skipDirs: string[] = ['Thumbnails'],
): Promise<string[]> {
  const MOVIES_DIR = directory || process.env.MOVIES_DIR || path.join(process.cwd(), 'media', 'movies');
  const movies: string[] = [];
  const skipSet = new Set(skipDirs);

  async function scanDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (skipSet.has(entry.name)) continue;
          if (recursive) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (MOVIE_EXTENSIONS.includes(ext)) {
            movies.push(fullPath);
          }
        }
      }
    } catch (error: any) {
      logger.warn(`[MovieHandler] Failed to scan directory: ${dir}`, { error: error.message });
    }
  }

  await scanDir(MOVIES_DIR);
  return movies;
}

/**
 * Batch process movies in a directory
 */
export async function batchProcessMovies(
  directory?: string,
  options: { concurrency?: number; autoOrganize?: boolean } = {},
): Promise<{ processed: number; failed: number; skipped: number }> {
  const { concurrency = 2, autoOrganize = true } = options;
  const movies = await scanMoviesDirectory(directory);

  logger.info(`[MovieHandler] Found ${movies.length} movies to process`);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Simple sequential processing (can be parallelized with job queue)
  for (const moviePath of movies) {
    try {
      await handleMovieProcessing(
        { inputPath: moviePath, autoOrganize },
        {} as JobContext,
        null, // No db for batch, or pass db if needed
      );
      processed++;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        skipped++;
      } else {
        failed++;
        logger.error(`[MovieHandler] Batch processing failed for: ${moviePath}`, {
          error: error.message,
        });
      }
    }
  }

  return { processed, failed, skipped };
}

/**
 * Clean up orphaned Thumbnails directories and their contents.
 * - Removes Thumbnails dirs whose parent has no video files
 * - Removes thumbnail files whose corresponding video no longer exists
 * - Removes empty Thumbnails dirs after cleanup
 */
export async function cleanupOrphanedThumbnails(directory?: string): Promise<number> {
  const MOVIES_DIR = directory || process.env.MOVIES_DIR || path.join(process.cwd(), 'media', 'movies');
  let removed = 0;

  async function findThumbnailDirs(dir: string): Promise<string[]> {
    const result: string[] = [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return result;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.name === 'Thumbnails') {
        result.push(fullPath);
      } else {
        result.push(...await findThumbnailDirs(fullPath));
      }
    }
    return result;
  }

  const thumbDirs = await findThumbnailDirs(MOVIES_DIR);

  for (const thumbDir of thumbDirs) {
    const parentDir = path.dirname(thumbDir);

    let parentEntries;
    try {
      parentEntries = await fs.readdir(parentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    const videoFiles = parentEntries
      .filter(e => e.isFile() && MOVIE_EXTENSIONS.includes(path.extname(e.name).toLowerCase()))
      .map(e => path.basename(e.name, path.extname(e.name)));

    // No videos in parent → remove entire Thumbnails dir
    if (videoFiles.length === 0) {
      try {
        await fs.rm(thumbDir, { recursive: true, force: true });
        removed++;
        logger.info(`[MovieHandler] Removed orphaned Thumbnails dir: ${path.relative(MOVIES_DIR, thumbDir)}`);
      } catch (err: any) {
        logger.warn(`[MovieHandler] Failed to remove Thumbnails dir: ${thumbDir}`, { error: err.message });
      }
      continue;
    }

    // Check individual thumbnail files for orphans
    let thumbEntries;
    try {
      thumbEntries = await fs.readdir(thumbDir, { withFileTypes: true });
    } catch {
      continue;
    }

    const videoBaseNames = new Set(videoFiles);

    for (const entry of thumbEntries) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(/^(.+?)_(thumb|sprite)\.jpg$/);
      if (!match) continue;
      if (!videoBaseNames.has(match[1])) {
        try {
          await fs.unlink(path.join(thumbDir, entry.name));
          removed++;
          logger.info(`[MovieHandler] Removed orphaned thumbnail: ${path.relative(MOVIES_DIR, path.join(thumbDir, entry.name))}`);
        } catch (err: any) {
          logger.warn(`[MovieHandler] Failed to remove orphaned thumbnail: ${entry.name}`, { error: err.message });
        }
      }
    }

    // If Thumbnails dir is now empty, remove it
    try {
      const remaining = await fs.readdir(thumbDir);
      if (remaining.length === 0) {
        await fs.rmdir(thumbDir);
        removed++;
        logger.info(`[MovieHandler] Removed empty Thumbnails dir: ${path.relative(MOVIES_DIR, thumbDir)}`);
      }
    } catch {
      // Already removed or still has contents
    }
  }

  return removed;
}

/**
 * Remove empty directories from the movies directory tree.
 * A directory is "empty" if it contains no video files and no subdirs with video files.
 * Never removes root MOVIES_DIR, Thumbnails/, or staging directories (1_inbox, etc.).
 */
const PROTECTED_DIR_NAMES = new Set(['1_inbox', '2_processing', '3_complete']);

export async function cleanupEmptyDirectories(directory?: string): Promise<number> {
  const MOVIES_DIR = directory || process.env.MOVIES_DIR || path.join(process.cwd(), 'media', 'movies');
  let removed = 0;

  async function hasVideoContent(dir: string): Promise<boolean> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (MOVIE_EXTENSIONS.includes(ext)) return true;
      } else if (entry.isDirectory() && entry.name !== 'Thumbnails') {
        if (await hasVideoContent(path.join(dir, entry.name))) return true;
      }
    }
    return false;
  }

  async function cleanDir(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // Recurse into subdirectories first (bottom-up cleanup)
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'Thumbnails') {
        await cleanDir(path.join(dir, entry.name));
      }
    }

    // Never remove root, protected staging dirs, or dirs with video content
    if (dir !== MOVIES_DIR && !PROTECTED_DIR_NAMES.has(path.basename(dir)) && !(await hasVideoContent(dir))) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        removed++;
        logger.info(`[MovieHandler] Removed empty directory: ${path.relative(MOVIES_DIR, dir)}`);
      } catch (err: any) {
        logger.warn(`[MovieHandler] Failed to remove empty directory: ${dir}`, { error: err.message });
      }
    }
  }

  await cleanDir(MOVIES_DIR);
  return removed;
}
