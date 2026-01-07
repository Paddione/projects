/**
 * Hash Utilities for VideoVault
 *
 * Provides fast hashing for file deduplication and change detection
 * Uses first 64KB + last 64KB + file size for performance
 */

const CHUNK_SIZE = 64 * 1024; // 64KB

/**
 * Calculate fast hash for a file
 *
 * Algorithm:
 * 1. Read first 64KB of file
 * 2. Read last 64KB of file (if file > 64KB)
 * 3. Combine with file size
 * 4. SHA-256 hash the combined data
 *
 * This is much faster than hashing the entire file and still provides
 * good deduplication detection for video files (which are large).
 *
 * @param file - File object to hash
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 */
export async function calculateFastHash(file: File): Promise<string> {
  const chunks: ArrayBuffer[] = [];

  // Read first 64KB
  const firstChunk = await file.slice(0, CHUNK_SIZE).arrayBuffer();
  chunks.push(firstChunk);

  // Read last 64KB (if file is larger than 64KB)
  if (file.size > CHUNK_SIZE) {
    const lastChunk = await file.slice(-CHUNK_SIZE).arrayBuffer();
    chunks.push(lastChunk);
  }

  // Include file size as additional entropy
  const sizeBytes = new TextEncoder().encode(file.size.toString());
  chunks.push(sizeBytes.buffer);

  // Combine all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  });

  // Calculate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Calculate hash from file handle
 *
 * Variant of calculateFastHash that works with FileSystemFileHandle
 *
 * @param fileHandle - FileSystemFileHandle to hash
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 */
export async function calculateFastHashFromHandle(
  fileHandle: FileSystemFileHandle,
): Promise<string> {
  const file = await fileHandle.getFile();
  return calculateFastHash(file);
}

/**
 * Simple hash function (fallback for older browsers without crypto.subtle)
 *
 * @param str - String to hash
 * @returns number - Simple hash code
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate hash-based directory path for thumbnail storage
 *
 * @param hash - Full hash string
 * @returns string - Directory path (e.g., "by-hash/ab/abc123def456")
 */
export function getHashBasedPath(hash: string): string {
  const prefix = hash.substring(0, 2);
  const shortHash = hash.substring(0, 16);
  return `by-hash/${prefix}/${shortHash}`;
}

/**
 * Get thumbnail filename for a hash
 *
 * @param hash - Full hash string
 * @param type - 'thumb' | 'sprite'
 * @param format - 'jpg' | 'webp' | 'png'
 * @returns string - Filename (e.g., "abc123def456_thumb.jpg")
 */
export function getThumbnailFilename(
  hash: string,
  type: 'thumb' | 'sprite' = 'thumb',
  format: 'jpg' | 'webp' | 'png' = 'jpg',
): string {
  const shortHash = hash.substring(0, 16);
  return `${shortHash}_${type}.${format}`;
}

/**
 * Get full thumbnail path
 *
 * @param hash - Full hash string
 * @param type - 'thumb' | 'sprite'
 * @param format - 'jpg' | 'webp' | 'png'
 * @returns string - Full relative path (e.g., "by-hash/ab/abc123def456_thumb.jpg")
 */
export function getThumbnailPath(
  hash: string,
  type: 'thumb' | 'sprite' = 'thumb',
  format: 'jpg' | 'webp' | 'png' = 'jpg',
): string {
  const dirPath = getHashBasedPath(hash);
  const filename = getThumbnailFilename(hash, type, format);
  return `${dirPath}_${type}.${format}`;
}

/**
 * Batch calculate hashes for multiple files
 *
 * @param files - Array of File objects
 * @param onProgress - Optional progress callback (current, total)
 * @returns Promise<Map<File, string>> - Map of File to hash
 */
export async function batchCalculateHashes(
  files: File[],
  onProgress?: (current: number, total: number) => void,
): Promise<Map<File, string>> {
  const results = new Map<File, string>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const hash = await calculateFastHash(file);
    results.set(file, hash);

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return results;
}

/**
 * Check if two files have the same hash (potential duplicate)
 *
 * @param file1 - First file
 * @param file2 - Second file
 * @returns Promise<boolean> - True if hashes match
 */
export async function areFilesDuplicate(file1: File, file2: File): Promise<boolean> {
  const [hash1, hash2] = await Promise.all([calculateFastHash(file1), calculateFastHash(file2)]);
  return hash1 === hash2;
}
