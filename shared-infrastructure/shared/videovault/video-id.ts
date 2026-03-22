/**
 * Deterministic video ID generation — shared between client and server.
 *
 * ID = sha256(rootKey + ':' + relativePath), truncated to 36 hex chars.
 *
 * This ensures the same physical file always gets the same ID regardless
 * of whether it was first scanned by the client or the server.
 */

/**
 * Generate a deterministic video ID from rootKey and relative path.
 * Works in both Node.js (crypto module) and browsers (Web Crypto API).
 */
export async function generateVideoId(rootKey: string, relativePath: string): Promise<string> {
  const input = `${rootKey}:${relativePath}`;

  // Node.js environment
  if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 36);
  }

  // Browser environment (Web Crypto API)
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 36);
}

/**
 * Synchronous version for server-side only (Node.js crypto).
 * Use generateVideoId() for cross-platform code.
 */
export function generateVideoIdSync(rootKey: string, relativePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${rootKey}:${relativePath}`).digest('hex').slice(0, 36);
}
