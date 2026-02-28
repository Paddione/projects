import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export const SIDECAR_FILENAME = 'metadata.json';

export interface SidecarData {
  version: number;
  id?: string;
  filename?: string;
  displayName?: string;
  size?: number;
  lastModified?: string;
  metadata?: {
    duration: number;
    width: number;
    height: number;
    bitrate: number;
    codec: string;
    fps: number;
    aspectRatio: string;
  };
  categories?: Record<string, string[]>;
  customCategories?: Record<string, string[]>;
}

/**
 * Read metadata.json sidecar from a video directory.
 * Returns null if file doesn't exist or is malformed.
 */
export async function readSidecar(dirPath: string): Promise<SidecarData | null> {
  const filePath = path.join(dirPath, SIDECAR_FILENAME);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[Sidecar] Failed to read ${filePath}`, { error: err.message });
    }
    return null;
  }
}

/**
 * Write metadata.json sidecar to a video directory.
 * Non-fatal: logs warning on failure, never throws.
 */
export async function writeSidecar(dirPath: string, data: SidecarData): Promise<void> {
  const filePath = path.join(dirPath, SIDECAR_FILENAME);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } catch (err: any) {
    logger.warn(`[Sidecar] Failed to write ${filePath}`, { error: err.message });
  }
}
