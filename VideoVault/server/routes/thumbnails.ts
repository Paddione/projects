import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../db';
import { directoryRoots } from '@shared/schema';
import { eq } from 'drizzle-orm';
// @ts-expect-error - No types available for this module
import { generateThumbnail } from '../../scripts/generate-thumbnails.mjs';
import { jobQueue } from '../lib/job-queue';

type ThumbnailRequestBody = {
  rootKey?: string;
  relativePath?: string;
};

type GenerateThumbnailResult = {
  thumbnailPath?: string;
  success?: boolean;
  message?: string;
};

const generateThumbnailTyped = generateThumbnail as (
  inputPath: string,
  options: { overwrite: boolean },
) => Promise<GenerateThumbnailResult>;

// Register handler
jobQueue.registerHandler('generate-thumbnail', async (data: { inputPath: string }) => {
  return await generateThumbnailTyped(data.inputPath, { overwrite: false });
});

export async function generateThumbnailRoute(
  req: Request<unknown, unknown, ThumbnailRequestBody>,
  res: Response,
) {
  const { rootKey, relativePath } = req.body;

  if (!rootKey || !relativePath) {
    return res.status(400).json({ error: 'rootKey and relativePath are required' });
  }

  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    // 1. Resolve absolute path
    const [root] = await db
      .select()
      .from(directoryRoots)
      .where(eq(directoryRoots.rootKey, rootKey))
      .limit(1);

    if (!root) {
      return res.status(404).json({ error: 'Root not found' });
    }

    const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(process.cwd(), 'Bibliothek');

    // Potential base paths to check for the file
    const candidateRoots = [
      path.join(MEDIA_ROOT, root.name),
      path.join(MEDIA_ROOT),
      path.join(process.cwd(), root.name),
      process.cwd(),
    ];

    if (root.directories) {
      for (const dir of root.directories) {
        if (path.isAbsolute(dir)) {
          candidateRoots.push(dir);
        }
      }
    }

    let foundPath: string | null = null;
    for (const rootPath of candidateRoots) {
      const candidate = path.join(rootPath, relativePath);
      try {
        await fs.access(candidate);
        foundPath = candidate;
        break;
      } catch {
        // continue
      }
    }

    if (!foundPath) {
      return res.status(404).json({ error: 'File not found in any root directory' });
    }

    // 2. Enqueue job
    const job = jobQueue.add('generate-thumbnail', { inputPath: foundPath });

    res.status(202).json({
      success: true,
      message: 'Thumbnail generation queued',
      jobId: job.id
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Thumbnail generation failed:', error);
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Unknown error' });
  }
}
