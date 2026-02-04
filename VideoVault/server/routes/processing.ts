import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { eq, like } from 'drizzle-orm';
import { videos } from '@shared/schema';
import { handleMovieProcessing, scanMoviesDirectory, batchProcessMovies, generateMovieThumbnail, MOVIE_EXTENSIONS } from '../handlers/movie-handler';
import { handleAudiobookProcessing, scanAudiobooksDirectory } from '../handlers/audiobook-handler';
import { handleEbookProcessing, scanEbooksDirectory } from '../handlers/ebook-handler';
import { jobQueue } from '../lib/job-queue';
import { logger } from '../lib/logger';
import { db } from '../db';

const router = Router();

// ============================================================================
// Movie Processing Routes
// ============================================================================

/**
 * POST /api/processing/movies/scan
 * Scan movies directory and return list of movie files
 */
router.post('/movies/scan', async (req: Request, res: Response) => {
  try {
    const { directory, recursive = true } = req.body;
    const movies = await scanMoviesDirectory(directory, recursive);

    res.json({
      success: true,
      count: movies.length,
      movies: movies.map((p) => ({
        path: p,
        filename: p.split('/').pop(),
      })),
    });
  } catch (error: any) {
    logger.error('[Processing] Movie scan failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/movies/process
 * Process a single movie file
 */
router.post('/movies/process', async (req: Request, res: Response) => {
  try {
    const { inputPath, autoOrganize = true, rootKey } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'inputPath is required' });
    }

    // Queue the job
    const job = jobQueue.add('process-movie', {
      inputPath,
      autoOrganize,
      rootKey,
    });

    res.status(202).json({
      success: true,
      message: 'Movie processing queued',
      jobId: job.id,
    });
  } catch (error: any) {
    logger.error('[Processing] Movie process failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/movies/batch
 * Batch process all movies in a directory
 */
router.post('/movies/batch', async (req: Request, res: Response) => {
  try {
    const { directory, autoOrganize = true, concurrency = 2 } = req.body;

    // Scan for movies first
    const movies = await scanMoviesDirectory(directory, true);

    if (movies.length === 0) {
      return res.json({
        success: true,
        message: 'No movies found to process',
        count: 0,
      });
    }

    // Queue all jobs
    const jobs = movies.map((moviePath) =>
      jobQueue.add('process-movie', {
        inputPath: moviePath,
        autoOrganize,
      }),
    );

    res.status(202).json({
      success: true,
      message: `Queued ${jobs.length} movies for processing`,
      count: jobs.length,
      jobIds: jobs.map((j) => j.id),
    });
  } catch (error: any) {
    logger.error('[Processing] Movie batch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Movie Management Routes (Rename, Delete, Organize)
// ============================================================================

const MOVIES_DIR = process.env.MOVIES_DIR || path.join(process.cwd(), 'media', 'movies');

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

function resolveAndValidateMovieDir(movieDir: string): string {
  const resolved = path.resolve(MOVIES_DIR, movieDir);
  if (!resolved.startsWith(path.resolve(MOVIES_DIR))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

/**
 * POST /api/processing/movies/rename
 * Rename a movie directory, its video file, and thumbnails
 */
router.post('/movies/rename', async (req: Request, res: Response) => {
  try {
    const { movieDir, newName } = req.body;
    if (!movieDir || !newName) {
      return res.status(400).json({ error: 'movieDir and newName are required' });
    }

    const resolvedDir = resolveAndValidateMovieDir(movieDir);
    const sanitizedNewName = sanitizeName(newName);
    if (!sanitizedNewName) {
      return res.status(400).json({ error: 'newName is empty after sanitization' });
    }

    // Verify directory exists
    const dirStat = await fs.stat(resolvedDir);
    if (!dirStat.isDirectory()) {
      return res.status(400).json({ error: 'movieDir is not a directory' });
    }

    // Find the video file inside the directory
    const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    const videoFile = entries.find(
      (e) => e.isFile() && MOVIE_EXTENSIONS.includes(path.extname(e.name).toLowerCase()),
    );
    if (!videoFile) {
      return res.status(400).json({ error: 'No video file found in directory' });
    }

    const oldBaseName = path.basename(videoFile.name, path.extname(videoFile.name));
    const ext = path.extname(videoFile.name);
    const thumbsDir = path.join(resolvedDir, 'Thumbnails');
    let thumbnailsGenerated = false;

    // 1. Rename thumbnails (if they exist)
    const thumbOld = path.join(thumbsDir, `${oldBaseName}_thumb.jpg`);
    const thumbNew = path.join(thumbsDir, `${sanitizedNewName}_thumb.jpg`);
    const spriteOld = path.join(thumbsDir, `${oldBaseName}_sprite.jpg`);
    const spriteNew = path.join(thumbsDir, `${sanitizedNewName}_sprite.jpg`);

    let thumbExists = false;
    let spriteExists = false;

    try {
      await fs.access(thumbOld);
      await fs.rename(thumbOld, thumbNew);
      thumbExists = true;
    } catch {}

    try {
      await fs.access(spriteOld);
      await fs.rename(spriteOld, spriteNew);
      spriteExists = true;
    } catch {}

    // 2. Rename the video file
    const videoOld = path.join(resolvedDir, videoFile.name);
    const videoNew = path.join(resolvedDir, `${sanitizedNewName}${ext}`);
    await fs.rename(videoOld, videoNew);

    // 3. Rename the directory itself
    const parentDir = path.dirname(resolvedDir);
    const newDirPath = path.join(parentDir, sanitizedNewName);
    await fs.rename(resolvedDir, newDirPath);

    // 4. Generate thumbnails if they didn't exist
    if (!thumbExists || !spriteExists) {
      try {
        const newThumbsDir = path.join(newDirPath, 'Thumbnails');
        await fs.mkdir(newThumbsDir, { recursive: true });
        const newVideoPath = path.join(newDirPath, `${sanitizedNewName}${ext}`);
        await generateMovieThumbnail(newVideoPath, newThumbsDir);
        thumbnailsGenerated = true;
      } catch (thumbError: any) {
        logger.warn('[Processing] Thumbnail generation failed during rename', {
          error: thumbError.message,
        });
      }
    }

    // 5. Update database record if it exists
    const oldRelPath = path.relative(MOVIES_DIR, resolvedDir);
    const newRelPath = path.relative(MOVIES_DIR, newDirPath);

    try {
      if (db) {
        await db
          .update(videos)
          .set({
            path: `${newRelPath}/${sanitizedNewName}${ext}`,
            filename: `${sanitizedNewName}${ext}`,
            displayName: sanitizedNewName,
          })
          .where(like(videos.path, `${oldRelPath}/%`));
      }
    } catch (dbError: any) {
      logger.warn('[Processing] DB update failed during rename (non-fatal)', {
        error: dbError.message,
      });
    }

    logger.info(`[Processing] Movie renamed: ${oldRelPath} -> ${newRelPath}`);

    res.json({
      success: true,
      oldPath: oldRelPath,
      newPath: newRelPath,
      thumbnailsGenerated,
    });
  } catch (error: any) {
    logger.error('[Processing] Movie rename failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/movies/delete
 * Delete a movie directory and all its contents
 */
router.post('/movies/delete', async (req: Request, res: Response) => {
  try {
    const { movieDir } = req.body;
    if (!movieDir) {
      return res.status(400).json({ error: 'movieDir is required' });
    }

    const resolvedDir = resolveAndValidateMovieDir(movieDir);

    // Verify it exists and is a directory
    const dirStat = await fs.stat(resolvedDir);
    if (!dirStat.isDirectory()) {
      return res.status(400).json({ error: 'movieDir is not a directory' });
    }

    const relPath = path.relative(MOVIES_DIR, resolvedDir);

    // Remove the entire directory
    await fs.rm(resolvedDir, { recursive: true, force: true });

    // Delete matching database records
    let dbDeleted = 0;
    try {
      if (db) {
        const result = await db
          .delete(videos)
          .where(like(videos.path, `${relPath}/%`));
        dbDeleted = result?.rowCount ?? 0;
      }
    } catch (dbError: any) {
      logger.warn('[Processing] DB delete failed during movie delete (non-fatal)', {
        error: dbError.message,
      });
    }

    logger.info(`[Processing] Movie deleted: ${relPath}`, { dbDeleted });

    res.json({
      success: true,
      deleted: relPath,
      dbRecordsRemoved: dbDeleted,
    });
  } catch (error: any) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ error: 'Directory not found' });
    }
    logger.error('[Processing] Movie delete failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/movies/organize-inbox
 * Organize loose video files into directories with thumbnails
 */
router.post('/movies/organize-inbox', async (req: Request, res: Response) => {
  try {
    const { source = '1_inbox', destination = '3_complete' } = req.body;

    const sourceDir = resolveAndValidateMovieDir(source);
    const destDir = resolveAndValidateMovieDir(destination);

    // Verify source exists
    await fs.access(sourceDir);
    await fs.mkdir(destDir, { recursive: true });

    // Scan for video files (top-level only)
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    const videoFiles = entries.filter(
      (e) => e.isFile() && MOVIE_EXTENSIONS.includes(path.extname(e.name).toLowerCase()),
    );

    if (videoFiles.length === 0) {
      return res.json({
        success: true,
        message: 'No video files found in source directory',
        processed: 0,
        failed: 0,
        results: [],
      });
    }

    const results: Array<{ file: string; status: string; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const entry of videoFiles) {
      const videoPath = path.join(sourceDir, entry.name);
      const baseName = path.basename(entry.name, path.extname(entry.name));
      const dirName = sanitizeName(baseName);
      const tempDir = path.join(sourceDir, dirName);
      const thumbsDir = path.join(tempDir, 'Thumbnails');
      const finalDir = path.join(destDir, dirName);

      try {
        // Create directory structure in source
        await fs.mkdir(thumbsDir, { recursive: true });

        // Move video into the new directory
        const newVideoPath = path.join(tempDir, entry.name);
        await fs.rename(videoPath, newVideoPath);

        // Generate thumbnails
        try {
          await generateMovieThumbnail(newVideoPath, thumbsDir);
        } catch (thumbError: any) {
          logger.warn(`[Processing] Thumbnail generation failed for ${entry.name}`, {
            error: thumbError.message,
          });
        }

        // Move organized directory to destination
        await fs.rename(tempDir, finalDir);

        results.push({ file: entry.name, status: 'ok' });
        processed++;
      } catch (fileError: any) {
        results.push({ file: entry.name, status: 'error', error: fileError.message });
        failed++;
        logger.error(`[Processing] Failed to organize ${entry.name}`, {
          error: fileError.message,
        });
      }
    }

    logger.info(`[Processing] Inbox organized: ${processed} processed, ${failed} failed`);

    res.json({
      success: true,
      processed,
      failed,
      results,
    });
  } catch (error: any) {
    logger.error('[Processing] Organize inbox failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Audiobook Processing Routes
// ============================================================================

/**
 * POST /api/processing/audiobooks/scan
 * Scan audiobooks directory and return list of audiobook folders
 */
router.post('/audiobooks/scan', async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    const audiobooks = await scanAudiobooksDirectory(directory);

    res.json({
      success: true,
      count: audiobooks.length,
      audiobooks,
    });
  } catch (error: any) {
    logger.error('[Processing] Audiobook scan failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/audiobooks/process
 * Process a single audiobook folder
 */
router.post('/audiobooks/process', async (req: Request, res: Response) => {
  try {
    const { inputPath, autoOrganize = true, rootKey } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'inputPath is required' });
    }

    // Queue the job
    const job = jobQueue.add('process-audiobook', {
      inputPath,
      autoOrganize,
      rootKey,
    });

    res.status(202).json({
      success: true,
      message: 'Audiobook processing queued',
      jobId: job.id,
    });
  } catch (error: any) {
    logger.error('[Processing] Audiobook process failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/audiobooks/batch
 * Batch process all audiobooks in a directory
 */
router.post('/audiobooks/batch', async (req: Request, res: Response) => {
  try {
    const { directory, autoOrganize = true } = req.body;

    // Scan for audiobooks first
    const audiobooks = await scanAudiobooksDirectory(directory);

    if (audiobooks.length === 0) {
      return res.json({
        success: true,
        message: 'No audiobooks found to process',
        count: 0,
      });
    }

    // Queue all jobs
    const jobs = audiobooks.map((ab) =>
      jobQueue.add('process-audiobook', {
        inputPath: ab.path,
        autoOrganize,
      }),
    );

    res.status(202).json({
      success: true,
      message: `Queued ${jobs.length} audiobooks for processing`,
      count: jobs.length,
      jobIds: jobs.map((j) => j.id),
    });
  } catch (error: any) {
    logger.error('[Processing] Audiobook batch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Ebook Processing Routes
// ============================================================================

/**
 * POST /api/processing/ebooks/scan
 * Scan ebooks directory and return list of ebook folders
 */
router.post('/ebooks/scan', async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    const ebooks = await scanEbooksDirectory(directory);

    res.json({
      success: true,
      count: ebooks.length,
      ebooks,
    });
  } catch (error: any) {
    logger.error('[Processing] Ebook scan failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/ebooks/process
 * Process a single ebook folder
 */
router.post('/ebooks/process', async (req: Request, res: Response) => {
  try {
    const { inputPath, autoOrganize = true, rootKey } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'inputPath is required' });
    }

    // Queue the job
    const job = jobQueue.add('process-ebook', {
      inputPath,
      autoOrganize,
      rootKey,
    });

    res.status(202).json({
      success: true,
      message: 'Ebook processing queued',
      jobId: job.id,
    });
  } catch (error: any) {
    logger.error('[Processing] Ebook process failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/processing/ebooks/batch
 * Batch process all ebooks in a directory
 */
router.post('/ebooks/batch', async (req: Request, res: Response) => {
  try {
    const { directory, autoOrganize = true } = req.body;

    // Scan for ebooks first
    const ebooks = await scanEbooksDirectory(directory);

    if (ebooks.length === 0) {
      return res.json({
        success: true,
        message: 'No ebooks found to process',
        count: 0,
      });
    }

    // Queue all jobs
    const jobs = ebooks.map((eb) =>
      jobQueue.add('process-ebook', {
        inputPath: eb.path,
        autoOrganize,
      }),
    );

    res.status(202).json({
      success: true,
      message: `Queued ${jobs.length} ebooks for processing`,
      count: jobs.length,
      jobIds: jobs.map((j) => j.id),
    });
  } catch (error: any) {
    logger.error('[Processing] Ebook batch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Combined Processing Routes
// ============================================================================

/**
 * POST /api/processing/scan-all
 * Scan all media directories and return counts
 */
router.post('/scan-all', async (req: Request, res: Response) => {
  try {
    const [movies, audiobooks, ebooks] = await Promise.all([
      scanMoviesDirectory().catch(() => []),
      scanAudiobooksDirectory().catch(() => []),
      scanEbooksDirectory().catch(() => []),
    ]);

    res.json({
      success: true,
      counts: {
        movies: movies.length,
        audiobooks: audiobooks.length,
        ebooks: ebooks.length,
        total: movies.length + audiobooks.length + ebooks.length,
      },
    });
  } catch (error: any) {
    logger.error('[Processing] Scan all failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/processing/stats
 * Get processing statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = jobQueue.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error('[Processing] Stats failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Register Job Handlers
// ============================================================================

// Register movie processing handler
jobQueue.registerHandler('process-movie', async (data) => {
  return await handleMovieProcessing(data, {} as any, db);
});

// Register audiobook processing handler (will be implemented)
jobQueue.registerHandler('process-audiobook', async (data) => {
  return await handleAudiobookProcessing(data, {} as any, db);
});

// Register ebook processing handler (will be implemented)
jobQueue.registerHandler('process-ebook', async (data) => {
  return await handleEbookProcessing(data, {} as any, db);
});

export default router;
