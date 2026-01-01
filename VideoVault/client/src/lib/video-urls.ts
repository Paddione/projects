import { Video } from '@/types/video';
import { VideoUrlRegistry } from '@/services/video-url-registry';

export const getVideoSrc = (video: Video): string | undefined => {
  // 1. Check local registry (for newly dropped/imported files not yet uploaded/persisted)
  const localUrl = VideoUrlRegistry.get(video.id);
  if (localUrl) return localUrl;

  // 2. Construct server URL from path
  if (!video.path) return undefined;

  // Mapping for Processed directory
  // DB Path: /home/patrick/VideoVault/Processed/...
  if (video.path.includes('/Processed/')) {
    const parts = video.path.split('/Processed/');
    if (parts.length > 1) {
      // encodeURI to handle spaces and special chars
      return `/media/processed/${parts[1]}`
        .split('/')
        .map(encodeURIComponent)
        .join('/')
        .replace('%2F', '/')
        .replace('%2F', '/');
    }
  }

  // Mapping for Bibliothek (Default Library)
  // DB Path: .../Bibliothek/...
  if (video.path.includes('/Bibliothek/')) {
    const parts = video.path.split('/Bibliothek/');
    if (parts.length > 1) {
      return `/media/${parts[1]}`
        .split('/')
        .map(encodeURIComponent)
        .join('/')
        .replace('%2F', '/')
        .replace('%2F', '/');
    }
  }

  // Basic fallback: if path is absolute but we don't recognize root,
  // we can't serve it unless we map another root.
  // For now, return undefined.
  return undefined;
};

export const getThumbnailSrc = (video: Video): string | undefined => {
  // 1. If DB has a dataUrl, use it (unless it is a local file path which browsers block)
  if (video.thumbnail?.dataUrl && !video.thumbnail.dataUrl.startsWith('file://')) {
    return video.thumbnail.dataUrl;
  }

  // 2. Try to construct from path
  if (!video.path) return undefined;
  const baseName = video.filename.replace(/\.[^.]+$/, '');

  if (video.path.includes('/Processed/')) {
    const parts = video.path.split('/Processed/');
    if (parts.length > 1) {
      const rel = parts[1];
      const dir = rel.substring(0, rel.lastIndexOf('/'));
      // Construct path relative to /media/processed
      // e.g. /media/processed/Thumbnails/subdir/video_thumb.jpg
      const path = `/media/processed/Thumbnails/${dir ? dir + '/' : ''}${baseName}_thumb.jpg`;
      return path
        .split('/')
        .map(encodeURIComponent)
        .join('/')
        .replace('%2F', '/')
        .replace('%2F', '/');
    }
  }

  if (video.path.includes('/Bibliothek/')) {
    const parts = video.path.split('/Bibliothek/');
    if (parts.length > 1) {
      const rel = parts[1];
      const dir = rel.substring(0, rel.lastIndexOf('/'));
      const path = `/media/${dir ? dir + '/' : ''}${baseName}-thumb.jpg`;
      return path
        .split('/')
        .map(encodeURIComponent)
        .join('/')
        .replace('%2F', '/')
        .replace('%2F', '/');
    }
  }

  return undefined;
};

export const getSpriteSrc = (video: Video): string | undefined => {
  if (!video.path) return undefined;
  const baseName = video.filename.replace(/\.[^.]+$/, '');

  if (video.path.includes('/Processed/')) {
    const parts = video.path.split('/Processed/');
    if (parts.length > 1) {
      const rel = parts[1];
      const dir = rel.substring(0, rel.lastIndexOf('/'));
      // Processed usually uses _sprite.jpg
      const path = `/media/processed/Thumbnails/${dir ? dir + '/' : ''}${baseName}_sprite.jpg`;
      return path
        .split('/')
        .map(encodeURIComponent)
        .join('/')
        .replace('%2F', '/')
        .replace('%2F', '/');
    }
  }

  if (video.path.includes('/Bibliothek/')) {
    const parts = video.path.split('/Bibliothek/');
    if (parts.length > 1) {
      const rel = parts[1];
      const dir = rel.substring(0, rel.lastIndexOf('/'));
      // Bibliothek usually uses -sprite.jpg
      const path = `/media/${dir ? dir + '/' : ''}${baseName}-sprite.jpg`;
      return path
        .split('/')
        .map(encodeURIComponent)
        .join('/')
        .replace('%2F', '/')
        .replace('%2F', '/');
    }
  }

  return undefined;
};
