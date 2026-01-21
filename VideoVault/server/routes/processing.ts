import { Router, Request, Response } from 'express';
import { handleMovieProcessing, scanMoviesDirectory, batchProcessMovies } from '../handlers/movie-handler';
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
