import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { eq, and } from 'drizzle-orm';
import { videos, scanState, directoryRoots } from '@shared/schema';
import { logger } from '../lib/logger';
import type { JobContext } from '../lib/enhanced-job-queue';

export interface MetadataJobPayload {
  inputPath: string;
  videoId: string;
  rootKey?: string;
  relativePath?: string;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  fps: number;
  aspectRatio: string;
}

/**
 * Extract video metadata using ffprobe
 */
function extractMetadataWithFFprobe(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      '-select_streams',
      'v:0',
      filePath,
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams.find((s: any) => s.codec_type === 'video');

        if (!videoStream) {
          return reject(new Error('No video stream found'));
        }

        // Parse fps (e.g., "30000/1001" or "30")
        const fpsRatio = videoStream.r_frame_rate || videoStream.avg_frame_rate;
        let fps = 30; // default fallback
        if (fpsRatio) {
          const [num, den] = fpsRatio.split('/').map(Number);
          fps = den ? num / den : num;
        }

        // Calculate aspect ratio (GCD-based simplified ratio)
        const width = videoStream.width;
        const height = videoStream.height;
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height);
        const aspectRatio = `${width / divisor}:${height / divisor}`;

        resolve({
          duration: parseFloat(data.format.duration) || 0,
          width,
          height,
          bitrate: parseInt(data.format.bit_rate) || 0,
          codec: videoStream.codec_name || 'unknown',
          fps: Math.round(fps * 100) / 100,
          aspectRatio,
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
 * Resolve a relative path to an absolute path using rootKey and MEDIA_ROOT
 * Tries multiple candidate paths to find where the file actually exists
 */
async function resolveInputPath(
  relativePath: string,
  rootKey: string | undefined,
  db: any,
): Promise<string | null> {
  const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(process.cwd(), 'Bibliothek');

  // If inputPath is already absolute, verify it exists
  if (path.isAbsolute(relativePath)) {
    try {
      await fs.access(relativePath);
      return relativePath;
    } catch {
      logger.warn(`[MetadataHandler] Absolute path not found: ${relativePath}`);
      return null;
    }
  }

  // Build candidate root paths
  const candidateRoots: string[] = [MEDIA_ROOT];

  // Try to look up root from database if rootKey is provided
  if (rootKey && db) {
    try {
      const [root] = await db
        .select()
        .from(directoryRoots)
        .where(eq(directoryRoots.rootKey, rootKey))
        .limit(1);

      if (root) {
        // Add root name subdirectory
        candidateRoots.unshift(path.join(MEDIA_ROOT, root.name));

        // Add any stored directory paths
        if (root.directories && Array.isArray(root.directories)) {
          for (const dir of root.directories) {
            if (path.isAbsolute(dir)) {
              candidateRoots.push(dir);
            }
          }
        }
      }
    } catch (error: any) {
      logger.warn(`[MetadataHandler] Failed to look up root: ${rootKey}`, { error: error?.message });
    }
  }

  // Also try common fallback paths
  candidateRoots.push(
    path.join(process.cwd(), 'Bibliothek'),
    process.cwd(),
  );

  // Try each candidate to find where the file exists
  for (const rootPath of candidateRoots) {
    const candidate = path.join(rootPath, relativePath);
    try {
      await fs.access(candidate);
      logger.debug(`[MetadataHandler] Resolved path: ${relativePath} -> ${candidate}`);
      return candidate;
    } catch {
      // Continue to next candidate
    }
  }

  logger.error(`[MetadataHandler] Could not resolve path: ${relativePath}`, {
    rootKey,
    triedPaths: candidateRoots.map((r) => path.join(r, relativePath)),
  });
  return null;
}

/**
 * Metadata Extraction Handler
 *
 * Uses ffprobe to extract accurate video metadata:
 * - Duration, resolution, bitrate
 * - Real FPS (not hardcoded 30fps)
 * - Codec, aspect ratio
 */
export async function handleMetadataExtraction(
  data: MetadataJobPayload,
  context: JobContext,
  db: any,
) {
  const { inputPath, videoId, rootKey, relativePath } = data;

  logger.info(`[MetadataHandler] Extracting metadata for: ${inputPath}`, { videoId, rootKey });

  try {
    // Resolve relative path to absolute path
    const resolvedPath = await resolveInputPath(inputPath, rootKey, db);
    if (!resolvedPath) {
      throw new Error(`Could not resolve input path: ${inputPath} (rootKey: ${rootKey})`);
    }

    logger.info(`[MetadataHandler] Resolved path: ${inputPath} -> ${resolvedPath}`);

    // Extract metadata using ffprobe
    const metadata = await extractMetadataWithFFprobe(resolvedPath);

    logger.info(`[MetadataHandler] Extracted metadata for: ${inputPath}`, {
      videoId,
      ...metadata,
    });

    // Update video record with extracted metadata
    if (db) {
      await db
        .update(videos)
        .set({
          bitrate: metadata.bitrate,
          codec: metadata.codec,
          fps: metadata.fps.toString(),
          aspectRatio: metadata.aspectRatio,
          metadataExtractedAt: new Date(),
          processingStatus: 'metadata_extracted',
          // Also update the metadata JSONB column for compatibility
          metadata: {
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            bitrate: metadata.bitrate,
            codec: metadata.codec,
            fps: metadata.fps,
            aspectRatio: metadata.aspectRatio,
          },
        })
        .where(eq(videos.id, videoId));

      // Update scan_state
      if (rootKey && relativePath) {
        await db
          .update(scanState)
          .set({ metadataExtracted: 'true' as any })
          .where(and(eq(scanState.rootKey, rootKey), eq(scanState.relativePath, relativePath)));
      }
    }

    return {
      status: 'completed',
      metadata,
    };
  } catch (error: any) {
    logger.error(`[MetadataHandler] Failed to extract metadata for: ${inputPath}`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
