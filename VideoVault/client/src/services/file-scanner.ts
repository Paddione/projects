import { Video, VideoCategories, CustomCategories } from '../types/video';
import { CategoryExtractor } from './category-extractor';
import { VideoThumbnailService } from './video-thumbnail';
import { VideoUrlRegistry } from './video-url-registry';
import { DirectoryHandleRegistry } from './directory-handle-registry';
import { DirectoryDatabase } from './directory-database';
import { ApiClient } from './api-client';
import { SpriteCache } from './sprite-cache';
import { setSpriteMeta } from './sprite-indexeddb';

export class FileScanner {
  private static readonly SUPPORTED_EXTENSIONS = [
    '.mp4',
    '.avi',
    '.mov',
    '.mkv',
    '.wmv',
    '.webm',
    '.m4v',
  ];

  static async scanDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    progressCallback?: (current: number, total: number) => void,
    abortSignal?: AbortSignal,
  ): Promise<Video[]> {
    const videos: Video[] = [];

    // Create a session root key and register it
    const rootKey = `${(directoryHandle as any).name || 'root'}_${Date.now()}${abortSignal ? `_${Math.random().toString(36).slice(2, 6)}` : ''}`;
    DirectoryHandleRegistry.registerRoot(rootKey, directoryHandle);

    const { files, directories } = await this.getAllVideoFilesAndDirs(directoryHandle);

    // Persist directory structure for this root
    await DirectoryDatabase.setRootDirectories(
      rootKey,
      Array.from(directories),
      (directoryHandle as any).name,
    );

    let current = 0;
    const total = files.length;

    // Concurrency-limited processing
    const concurrency = this.determineConcurrency();
    let nextIndex = 0;
    const inFlight = new Set<Promise<void>>();

    const launchNext = () => {
      if (abortSignal?.aborted) return;
      if (nextIndex >= files.length) return;
      const entry = files[nextIndex++];

      const p = (async () => {
        try {
          const file = await entry.fileHandle.getFile();
          if (abortSignal?.aborted) return;
          const video = await this.generateVideoMetadata(
            file,
            entry.fileHandle,
            entry.relativePath,
            entry.parentDirHandle,
            rootKey,
          );
          if (abortSignal?.aborted) return;
          videos.push(video);
        } catch (error) {
          if (abortSignal?.aborted) return;
          console.warn(`Failed to process file ${entry.fileHandle.name}:`, error);
        } finally {
          if (!abortSignal?.aborted) {
            current++;
            if (progressCallback) {
              try {
                progressCallback(current, total);
              } catch (_e) {}
            }
          }
        }
      })();

      inFlight.add(p);
      void p.finally(() => inFlight.delete(p));
    };

    for (let i = 0; i < concurrency && i < files.length; i++) {
      launchNext();
    }

    while (!abortSignal?.aborted && (nextIndex < files.length || inFlight.size > 0)) {
      if (inFlight.size === 0) break;
      await Promise.race(inFlight);
      // Top off the pool
      while (!abortSignal?.aborted && inFlight.size < concurrency && nextIndex < files.length) {
        launchNext();
      }
    }

    // If aborted, drain remaining tasks quietly without reporting progress
    if (abortSignal?.aborted && inFlight.size > 0) {
      try {
        await Promise.allSettled(Array.from(inFlight));
      } catch (_e) {}
    }

    return videos;
  }

  private static async getAllVideoFilesAndDirs(
    directoryHandle: FileSystemDirectoryHandle,
    basePath: string = '',
  ): Promise<{
    files: Array<{
      fileHandle: FileSystemFileHandle;
      relativePath: string;
      parentDirHandle: FileSystemDirectoryHandle;
    }>;
    directories: Set<string>;
  }> {
    const files: Array<{
      fileHandle: FileSystemFileHandle;
      relativePath: string;
      parentDirHandle: FileSystemDirectoryHandle;
    }> = [];
    const directories = new Set<string>();

    const anyDir: any = directoryHandle as any;
    if (anyDir && typeof anyDir.entries === 'function') {
      for await (const [name, handle] of anyDir.entries() as AsyncIterable<
        [string, FileSystemHandle]
      >) {
        if (handle.kind === 'file') {
          const extension = this.getFileExtension(name);
          if (this.SUPPORTED_EXTENSIONS.includes(extension)) {
            files.push({
              fileHandle: handle as FileSystemFileHandle,
              relativePath: `${basePath}${name}`,
              parentDirHandle: directoryHandle,
            });
          }
        } else if (handle.kind === 'directory') {
          const dirRelPath = `${basePath}${name}/`;
          directories.add(dirRelPath);
          const sub = await this.getAllVideoFilesAndDirs(
            handle as FileSystemDirectoryHandle,
            dirRelPath,
          );
          sub.directories.forEach((d) => directories.add(d));
          files.push(...sub.files);
        }
      }
    }

    return { files, directories };
  }

  static async generateVideoMetadata(
    file: File,
    fileHandle: FileSystemFileHandle,
    relativePath: string,
    parentDirHandle?: FileSystemDirectoryHandle,
    rootKey?: string,
  ): Promise<Video> {
    const categories = this.extractCategoriesFromFilename(file.name);

    // Prefer external pre-generated thumbnails from the same directory or sibling 'thumbnails' folder
    let thumbnail = undefined as any;
    try {
      if (parentDirHandle) {
        thumbnail = await (VideoThumbnailService as any).tryReadExternalThumbnail?.(
          parentDirHandle,
          file.name,
        );
      }
    } catch (_e) {
      // ignore and fallback to generation
    }

    if (!thumbnail && rootKey && relativePath) {
      // Trigger server-side generation in background (fire and forget)
      ApiClient.post('/api/thumbnails/generate', { rootKey, relativePath }).catch((err: any) =>
        console.warn('Failed to trigger thumbnail generation:', err.message || err),
      );
    }

    if (!thumbnail) {
      thumbnail = await VideoThumbnailService.generateThumbnail(file);
    }
    const metadata = await VideoThumbnailService.extractVideoMetadata(file);

    // Add quality category based on detected resolution
    const quality = VideoThumbnailService.determineQuality(metadata.width, metadata.height);
    if (quality && !categories.quality.includes(quality.toLowerCase())) {
      categories.quality.push(quality.toLowerCase());
    }

    const video: Video = {
      id: this.generateVideoId(file.name, file.size, file.lastModified),
      filename: file.name,
      displayName: this.generateDisplayName(file.name),
      path: relativePath || file.name,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString(),
      categories,
      customCategories: {},
      metadata,
      thumbnail,
      rootKey,
    };

    // Create and store blob URL for playback
    VideoUrlRegistry.register(video.id, file);

    // Check for external sprite sheet
    if (parentDirHandle) {
      try {
        const spriteDataUrl = await VideoThumbnailService.tryReadExternalSprite(
          parentDirHandle,
          file.name,
        );
        if (spriteDataUrl) {
          const img = new Image();
          img.src = spriteDataUrl;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });

          if (img.naturalWidth > 0) {
            const cols = Math.max(1, Math.floor(img.naturalWidth / 64));
            const frameWidth = 64;
            const frameHeight = img.naturalHeight;

            SpriteCache.set(video.id, { cols, frameWidth, frameHeight }, spriteDataUrl, 2);
            setSpriteMeta(video.id, { cols, frameWidth, frameHeight }).catch(() => {});
            console.log(`[Scanner] Loaded external sprite for ${file.name}`);
          }
        }
      } catch (e) {
        console.warn('Failed to load external sprite:', e);
      }
    }

    // Keep a handle reference for potential filesystem operations in this session
    try {
      // fileHandle may be a mock when files are dropped; ignore failures
      const { FileHandleRegistry } = await import('./file-handle-registry');
      FileHandleRegistry.register(video.id, fileHandle);
      if (parentDirHandle && rootKey) {
        DirectoryHandleRegistry.registerParentForFile(video.id, parentDirHandle, rootKey);
      }
    } catch (_e) {
      // ignore
    }

    return video;
  }

  static extractCategoriesFromFilename(filename: string): VideoCategories {
    return CategoryExtractor.extractCategories(filename);
  }

  private static generateVideoId(filename: string, size: number, lastModified: number): string {
    // Encode using UTF-8 bytes to avoid InvalidCharacterError from btoa on non-Latin1
    const input = `${filename}-${size}-${lastModified}`;
    try {
      const bytes = new TextEncoder().encode(input);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/[+/=]/g, '');
    } catch (_e) {
      // Fallback path using encodeURIComponent in unlikely environments
      try {
        // unescape is deprecated but acceptable as a guarded fallback
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return btoa(unescape(encodeURIComponent(input))).replace(/[+/=]/g, '');
      } catch (_e2) {
        // As a last resort, return a simple hashed-like id
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
          hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(36);
      }
    }
  }

  private static generateDisplayName(filename: string): string {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Replace common patterns and clean up
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w+\./g, '') // Remove patterns like "xvideos."
      .replace(/\b(mp4|avi|mkv|mov|wmv|hd|4k|1080p|720p|480p)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private static getFileExtension(filename: string): string {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }

  static async scanDroppedFiles(
    files: FileList,
    progressCallback?: (current: number, total: number) => void,
    abortSignal?: AbortSignal,
  ): Promise<Video[]> {
    const videos: Video[] = [];
    const videoFiles = Array.from(files).filter((file) => {
      const extension = this.getFileExtension(file.name);
      return this.SUPPORTED_EXTENSIONS.includes(extension);
    });

    let current = 0;
    const total = videoFiles.length;

    const concurrency = this.determineConcurrency();
    let nextIndex = 0;
    const inFlight = new Set<Promise<void>>();

    const launchNext = () => {
      if (abortSignal?.aborted) return;
      if (nextIndex >= videoFiles.length) return;
      const file = videoFiles[nextIndex++];

      const p = (async () => {
        try {
          // Create a mock file handle for compatibility
          const mockHandle = {
            name: file.name,
            getFile: () => Promise.resolve(file),
          } as FileSystemFileHandle;

          const video = await this.generateVideoMetadata(file, mockHandle, file.name);
          if (abortSignal?.aborted) return;
          videos.push(video);
        } catch (error) {
          if (abortSignal?.aborted) return;
          console.warn(`Failed to process dropped file ${file.name}:`, error);
        } finally {
          if (!abortSignal?.aborted) {
            current++;
            if (progressCallback) {
              try {
                progressCallback(current, total);
              } catch (_e) {}
            }
          }
        }
      })();

      inFlight.add(p);
      void p.finally(() => inFlight.delete(p));
    };

    for (let i = 0; i < concurrency && i < videoFiles.length; i++) {
      launchNext();
    }

    while (!abortSignal?.aborted && (nextIndex < videoFiles.length || inFlight.size > 0)) {
      if (inFlight.size === 0) break;
      await Promise.race(inFlight);
      while (
        !abortSignal?.aborted &&
        inFlight.size < concurrency &&
        nextIndex < videoFiles.length
      ) {
        launchNext();
      }
    }

    if (abortSignal?.aborted && inFlight.size > 0) {
      try {
        await Promise.allSettled(Array.from(inFlight));
      } catch (_e) {}
    }

    return videos;
  }

  private static determineConcurrency(): number {
    try {
      const hc = typeof navigator !== 'undefined' ? (navigator as any).hardwareConcurrency : 4;
      const suggested = Math.max(2, Math.floor((hc || 4) / 2));
      return Math.min(6, suggested);
    } catch (_e) {
      return 4;
    }
  }
}
