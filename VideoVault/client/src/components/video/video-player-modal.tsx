import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Video } from '@/types/video';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  RefreshCcw,
  PictureInPicture,
  Shuffle,
  Tags,
  Scissors,
  X,
  Focus,
} from 'lucide-react';
import { useMemo } from 'react';
import { VideoUrlRegistry } from '@/services/video-url-registry';
import { VideoThumbnailService } from '@/services/video-thumbnail';
import { VideoTagsEditor } from './video-tags-editor';
import { VideoSplitter, SplitVideoFormValues } from './video-splitter';
import { Category, VideoCategories, CustomCategories } from '@/types/video';
import { SplitVideoResult } from '@/services/video-splitter';
import { getVideoSrc, getThumbnailSrc } from '@/lib/video-urls';

declare global {
  interface HTMLVideoElement {
    fastSeek?: (time: number) => void;
  }
}

interface VideoPlayerModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onRescan?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  availableCategories?: Category[];
  onUpdateVideo?: (
    videoId: string,
    categories: Partial<{ categories: VideoCategories; customCategories: CustomCategories }>,
  ) => void;
  onRemoveCategory?: (videoId: string, categoryType: string, categoryValue: string) => void;
  onSplitVideo?: (payload: SplitVideoFormValues) => Promise<SplitVideoResult>;
  shuffleEnabled?: boolean;
  onToggleShuffle?: () => void;
  onFocusMode?: (video: Video) => void;
}

export function VideoPlayerModal({
  video,
  isOpen,
  onClose,
  onRescan,
  onPrev,
  onNext,
  availableCategories = [],
  onUpdateVideo,
  onRemoveCategory,
  onSplitVideo,
  shuffleEnabled,
  onToggleShuffle,
  onFocusMode,
}: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'tags' | 'split'>('none');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [isPip, setIsPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  // Hover preview state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [hoverPreviewUrl, setHoverPreviewUrl] = useState<string | null>(null);
  const hoverFetchTimeoutRef = useRef<number | null>(null);
  const previewCacheRef = useRef<Map<number, string>>(new Map());
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const gestureStateRef = useRef<{
    lastTap: number;
    timeoutId: number | null;
    startX: number;
    startTime: number;
  }>({
    lastTap: 0,
    timeoutId: null,
    startX: 0,
    startTime: 0,
  });
  const touchActiveRef = useRef(false);
  const [gestureMessage, setGestureMessage] = useState<string | null>(null);
  const gestureMessageTimeout = useRef<number | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    setPipSupported(
      !!document.pictureInPictureEnabled &&
        typeof videoElement.requestPictureInPicture === 'function',
    );

    const handleTimeUpdate = () => {
      if (!isScrubbing) {
        setCurrentTime(videoElement.currentTime);
      }
      updateBuffered();
    };
    const handleDurationChange = () =>
      setDuration(Number.isFinite(videoElement.duration) ? videoElement.duration : 0);
    const handleLoadedMetadata = () =>
      setDuration(Number.isFinite(videoElement.duration) ? videoElement.duration : 0);
    const handlePlay = () => {
      setIsPlaying(true);
      if (navigator.mediaSession) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (navigator.mediaSession) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch {}
      }
    };
    const handleProgress = () => updateBuffered();
    const handleEnterPip = () => setIsPip(true);
    const handleLeavePip = () => setIsPip(false);

    const updateBuffered = () => {
      try {
        const ranges = videoElement.buffered;
        if (ranges.length === 0) {
          setBuffered(0);
          return;
        }
        let end = 0;
        const t = isScrubbing ? scrubTime : videoElement.currentTime;
        for (let i = 0; i < ranges.length; i++) {
          const startI = ranges.start(i);
          const endI = ranges.end(i);
          if (t >= startI && t <= endI) {
            end = endI;
            break;
          }
          if (endI > end) end = endI;
        }
        setBuffered(end);
      } catch {
        setBuffered(0);
      }
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('progress', handleProgress);
    videoElement.addEventListener('enterpictureinpicture', handleEnterPip);
    videoElement.addEventListener('leavepictureinpicture', handleLeavePip);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('progress', handleProgress);
      videoElement.removeEventListener('enterpictureinpicture', handleEnterPip);
      videoElement.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, [isScrubbing, scrubTime]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (!video || !isOpen) return;
    if (!('mediaSession' in navigator)) return;

    try {
      const thumbSrc = getThumbnailSrc(video);
      (navigator.mediaSession as any).metadata = new window.MediaMetadata({
        title: video.displayName,
        artist: 'VideoVault',
        album: 'Library',
        artwork: thumbSrc ? [{ src: thumbSrc, sizes: '320x180', type: 'image/jpeg' }] : [],
      });

      navigator.mediaSession?.setActionHandler('play', () => {
        void videoRef.current?.play();
      });
      navigator.mediaSession?.setActionHandler('pause', () => {
        videoRef.current?.pause();
      });
      navigator.mediaSession?.setActionHandler('seekbackward', (details: any) => {
        const offset = details?.seekOffset ?? 10;
        skip(-offset);
      });
      navigator.mediaSession?.setActionHandler('seekforward', (details: any) => {
        const offset = details?.seekOffset ?? 10;
        skip(offset);
      });
      navigator.mediaSession?.setActionHandler('seekto', (details: any) => {
        const time = details?.seekTime;
        if (typeof time === 'number' && videoRef.current) {
          if (details?.fastSeek && videoRef.current.fastSeek) {
            try {
              videoRef.current.fastSeek(time);
              return;
            } catch {}
          }
          videoRef.current.currentTime = Math.max(0, Math.min(duration || 0, time));
        }
      });
      navigator.mediaSession?.setActionHandler('previoustrack', () => {
        onPrev?.();
      });
      navigator.mediaSession?.setActionHandler('nexttrack', () => {
        onNext?.();
      });
    } catch {}

    return () => {
      try {
        if (navigator.mediaSession) {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
          navigator.mediaSession.setActionHandler('seekto', null);
          navigator.mediaSession.setActionHandler('previoustrack', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
        }
      } catch {}
    };
  }, [video, isOpen, duration, onPrev, onNext]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        void videoRef.current.play();
      }
    }
  };

  const togglePip = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || !pipSupported) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture?.();
      } else {
        await videoEl.requestPictureInPicture?.();
      }
    } catch {}
  };

  const handleSeekCommit = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
    setIsScrubbing(false);
  };

  const handleSeekChange = (value: number[]) => {
    setIsScrubbing(true);
    setScrubTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void videoRef.current.requestFullscreen();
      }
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const elementDuration =
        typeof videoRef.current.duration === 'number' && Number.isFinite(videoRef.current.duration)
          ? videoRef.current.duration
          : undefined;
      const clampDuration =
        typeof elementDuration === 'number' && elementDuration > 0
          ? elementDuration
          : duration || 0;
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(clampDuration, videoRef.current.currentTime + seconds),
      );
    }
  };

  const showGestureMessage = (message: string) => {
    if (gestureMessageTimeout.current) {
      window.clearTimeout(gestureMessageTimeout.current);
    }
    setGestureMessage(message);
    gestureMessageTimeout.current = window.setTimeout(() => setGestureMessage(null), 900);
  };

  const handleGesturePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    touchActiveRef.current = true;
    gestureStateRef.current.startX = e.clientX;
    gestureStateRef.current.startTime = Date.now();
  };

  const handleGesturePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const now = Date.now();
    const deltaX = e.clientX - gestureStateRef.current.startX;
    const deltaTime = now - gestureStateRef.current.startTime;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    // Swipe seeking
    if (Math.abs(deltaX) > 90 && deltaTime < 500) {
      const direction = deltaX > 0 ? 1 : -1;
      skip(direction * 15);
      showGestureMessage(direction > 0 ? 'Seek +15s' : 'Seek -15s');
      gestureStateRef.current.lastTap = 0;
    } else {
      const isDouble = now - gestureStateRef.current.lastTap < 280;
      const tapX = e.clientX - rect.left;
      if (gestureStateRef.current.timeoutId) {
        window.clearTimeout(gestureStateRef.current.timeoutId);
        gestureStateRef.current.timeoutId = null;
      }

      if (isDouble) {
        const direction = tapX < rect.width / 2 ? -10 : 10;
        skip(direction);
        showGestureMessage(direction > 0 ? 'Seek +10s' : 'Seek -10s');
        gestureStateRef.current.lastTap = 0;
      } else {
        gestureStateRef.current.lastTap = now;
        const willPause = isPlaying;
        gestureStateRef.current.timeoutId = window.setTimeout(() => {
          togglePlayPause();
          showGestureMessage(willPause ? 'Paused' : 'Playing');
          gestureStateRef.current.timeoutId = null;
        }, 220);
      }
    }

    window.setTimeout(() => {
      touchActiveRef.current = false;
    }, 0);
  };

  // Debounced frame capture for hover preview
  const requestHoverPreview = (tSeconds: number) => {
    if (!sourceUrl) return;
    const whole = Math.max(0, Math.floor(tSeconds));
    const cache = previewCacheRef.current;
    if (cache.has(whole)) {
      setHoverPreviewUrl(cache.get(whole) || null);
      return;
    }
    if (hoverFetchTimeoutRef.current) window.clearTimeout(hoverFetchTimeoutRef.current);
    hoverFetchTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const dataUrl = await VideoThumbnailService.captureFrameAtTime(sourceUrl, whole, 160);
          cache.set(whole, dataUrl);
          if (hoverTime !== null && Math.floor(hoverTime) === whole) {
            setHoverPreviewUrl(dataUrl);
          }
        } catch {
          // ignore
        }
      })();
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (hoverFetchTimeoutRef.current) window.clearTimeout(hoverFetchTimeoutRef.current);
      if (gestureStateRef.current.timeoutId) window.clearTimeout(gestureStateRef.current.timeoutId);
      if (gestureMessageTimeout.current) window.clearTimeout(gestureMessageTimeout.current);
    };
  }, []);

  const formatTime = (time: number): string => {
    if (!Number.isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const sourceUrl = useMemo(
    () => (video ? getVideoSrc(video) : undefined),
    [video?.id, video?.path],
  );
  const hasSource = Boolean(sourceUrl);

  if (!video) return null;

  const effectiveTime = isScrubbing ? scrubTime : currentTime;
  const elementDuration =
    typeof videoRef.current?.duration === 'number' && Number.isFinite(videoRef.current?.duration)
      ? videoRef.current?.duration
      : undefined;
  const effectiveDuration =
    typeof elementDuration === 'number' && elementDuration > 0 ? elementDuration : duration;
  const sliderDisabled =
    !hasSource || !Number.isFinite(effectiveDuration) || effectiveDuration <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`w-full mx-4 p-0 transition-all duration-300 ${sidePanel !== 'none' ? 'max-w-7xl' : 'max-w-5xl'}`}
      >
        <DialogHeader className="p-4 border-b">
          <DialogTitle data-testid="text-video-title">{video.displayName}</DialogTitle>
          <DialogDescription className="sr-only">
            Video player with playback controls and navigation
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-[80vh] md:h-[calc(90vh-5rem)] overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-black relative">
            <div
              className="relative bg-black touch-pan-y flex-1"
              tabIndex={0}
              data-testid="player-surface"
              onPointerDown={handleGesturePointerDown}
              onPointerUp={handleGesturePointerUp}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                  togglePlayPause();
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  skip(e.shiftKey ? -30 : -5);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  skip(e.shiftKey ? 30 : 5);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  // Increase volume by 10%
                  const newVolume = Math.min(1, volume + 0.1);
                  setVolume(newVolume);
                  setIsMuted(false);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  // Decrease volume by 10%
                  const newVolume = Math.max(0, volume - 0.1);
                  setVolume(newVolume);
                  if (newVolume === 0) setIsMuted(true);
                } else if (e.key.toLowerCase() === 'm') {
                  e.preventDefault();
                  toggleMute();
                } else if (e.key.toLowerCase() === 'f') {
                  e.preventDefault();
                  toggleFullscreen();
                } else if (e.key.toLowerCase() === 'j') {
                  // Prev
                  e.preventDefault();
                  onPrev?.();
                } else if (e.key.toLowerCase() === 'k') {
                  // Next
                  e.preventDefault();
                  onNext?.();
                } else if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
                  // Seek to percentage (0-9 = 0%-90%)
                  e.preventDefault();
                  const percent = parseInt(e.key) / 10;
                  if (videoRef.current && effectiveDuration > 0) {
                    const seekTime = effectiveDuration * percent;
                    videoRef.current.currentTime = seekTime;
                    setCurrentTime(seekTime);
                  }
                }
              }}
            >
              {hasSource ? (
                <video
                  key={video.id}
                  ref={videoRef}
                  className="w-full h-full object-contain bg-black"
                  src={sourceUrl}
                  poster={getThumbnailSrc(video)}
                  data-testid="video-player"
                  preload="metadata"
                  playsInline
                  onClick={(event) => {
                    if (touchActiveRef.current) return;
                    togglePlayPause();
                  }}
                  onDoubleClick={toggleFullscreen}
                />
              ) : (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white space-y-3 p-4">
                  <span>Video source unavailable. Try rescanning or re-importing the file.</span>
                  <span className="text-xs opacity-80">Path: {video.path}</span>
                  {onRescan && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onRescan}
                      data-testid="button-rescan-root"
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" /> Rescan root to restore playback
                    </Button>
                  )}
                </div>
              )}

              {gestureMessage && (
                <div
                  className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full"
                  aria-live="polite"
                >
                  {gestureMessage}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-t from-black to-transparent p-4 z-10 w-full">
              <div className="space-y-2">
                <div
                  className="relative w-full"
                  data-testid="progress-area"
                  onMouseMove={(e) => {
                    if (!hasSource) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                    setHoverX(x);
                    const ratio = rect.width > 0 ? x / rect.width : 0;
                    const d = effectiveDuration > 0 ? effectiveDuration : 0;
                    const t = d * ratio;
                    setHoverTime(t);
                    requestHoverPreview(t);
                  }}
                  onMouseLeave={() => {
                    setHoverTime(null);
                    setHoverPreviewUrl(null);
                  }}
                  ref={previewContainerRef}
                >
                  {hoverTime !== null && !sliderDisabled && (
                    <div
                      className="absolute -top-28 flex flex-col items-center"
                      style={{
                        left: `${Math.max(0, Math.min((previewContainerRef.current?.clientWidth || 0) - 160, hoverX - 80))}px`,
                      }}
                      data-testid="thumbnail-preview"
                    >
                      <div className="pointer-events-none rounded border border-white/20 shadow-lg overflow-hidden bg-black">
                        {hoverPreviewUrl ? (
                          <img
                            src={hoverPreviewUrl}
                            alt="preview"
                            className="w-40 h-24 object-cover"
                          />
                        ) : (
                          <div className="w-40 h-24 bg-white/10" />
                        )}
                        <div className="w-40 text-center text-xs text-white py-1 bg-black/70">
                          {formatTime(hoverTime)}
                        </div>
                      </div>
                    </div>
                  )}

                  <Slider
                    value={[effectiveTime]}
                    max={effectiveDuration > 0 ? effectiveDuration : 1}
                    step={0.1}
                    onValueChange={handleSeekChange}
                    onValueCommit={handleSeekCommit}
                    className="w-full relative z-20"
                    data-testid="slider-progress"
                    buffer={buffered}
                    disabled={sliderDisabled}
                    aria-label="Seek"
                  />
                </div>

                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPrev}
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      data-testid="button-skip-back"
                      disabled={!onPrev}
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={togglePlayPause}
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      data-testid="button-play-pause"
                      disabled={!hasSource}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onNext}
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      data-testid="button-skip-forward"
                      disabled={!onNext}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => skip(600)}
                      className="text-white hover:bg-white hover:bg-opacity-20 hidden sm:inline-flex"
                      data-testid="button-forward-10m"
                      disabled={!hasSource}
                      aria-label="Forward 10 minutes"
                    >
                      +10m
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <span className="text-xs sm:text-sm" data-testid="text-time">
                      {formatTime(effectiveTime)} / {formatTime(effectiveDuration)}
                    </span>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="text-white hover:bg-white hover:bg-opacity-20"
                        data-testid="button-mute"
                        disabled={!hasSource}
                      >
                        {isMuted ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>

                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.05}
                        onValueChange={handleVolumeChange}
                        className="w-20 hidden sm:flex"
                        data-testid="slider-volume"
                        aria-label="Volume"
                        disabled={!hasSource}
                      />
                    </div>

                    <Button
                      variant={sidePanel === 'tags' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setSidePanel(sidePanel === 'tags' ? 'none' : 'tags')}
                      className={`text-white hover:bg-white hover:bg-opacity-20 ${sidePanel === 'tags' ? 'bg-white/20' : ''}`}
                      data-testid="button-edit-tags-inline"
                      disabled={!onUpdateVideo}
                      aria-label="Edit Tags"
                    >
                      <Tags className="h-4 w-4" />
                    </Button>

                    {onFocusMode && video && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onFocusMode(video);
                          onClose();
                        }}
                        className="text-white hover:bg-white hover:bg-opacity-20 hidden sm:inline-flex"
                        data-testid="button-focus-mode"
                        aria-label="Open in Focus Mode"
                        title="Open in Focus Mode"
                      >
                        <Focus className="h-4 w-4" />
                      </Button>
                    )}

                    {onSplitVideo && (
                      <Button
                        variant={sidePanel === 'split' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setSidePanel(sidePanel === 'split' ? 'none' : 'split')}
                        className={`text-white hover:bg-white hover:bg-opacity-20 hidden sm:inline-flex ${sidePanel === 'split' ? 'bg-white/20' : ''}`}
                        data-testid="button-split-inline"
                        aria-label="Split video"
                      >
                        <Scissors className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggleShuffle}
                      className="text-white hover:bg-white hover:bg-opacity-20 hidden sm:inline-flex"
                      data-testid="button-shuffle"
                      aria-pressed={!!shuffleEnabled}
                      aria-label="Shuffle"
                    >
                      <Shuffle className={`h-4 w-4 ${shuffleEnabled ? 'text-emerald-400' : ''}`} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void togglePip()}
                      className="text-white hover:bg-white hover:bg-opacity-20 hidden sm:inline-flex"
                      data-testid="button-pip"
                      disabled={!hasSource || !pipSupported}
                      aria-pressed={isPip}
                      aria-label="Picture in Picture"
                    >
                      <PictureInPicture className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFullscreen}
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      data-testid="button-fullscreen"
                      disabled={!hasSource}
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div
            className={`
              border-l bg-background transition-all duration-300 ease-in-out overflow-hidden flex flex-col
              ${sidePanel !== 'none' ? 'w-full md:w-96' : 'w-0'}
            `}
          >
            <div className="h-full overflow-y-auto p-4 min-w-[20rem]">
              {sidePanel === 'tags' && onUpdateVideo && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Edit Tags</h3>
                    <Button variant="ghost" size="icon" onClick={() => setSidePanel('none')}>
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close panel</span>
                    </Button>
                  </div>
                  <VideoTagsEditor
                    video={video}
                    availableCategories={availableCategories}
                    onSave={onUpdateVideo}
                    onRemoveCategory={onRemoveCategory || (() => {})}
                  />
                </>
              )}
              {sidePanel === 'split' && onSplitVideo && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Split Video</h3>
                    <Button variant="ghost" size="icon" onClick={() => setSidePanel('none')}>
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close panel</span>
                    </Button>
                  </div>
                  <VideoSplitter
                    video={video}
                    availableCategories={availableCategories}
                    onSubmit={onSplitVideo}
                    onCancel={() => setSidePanel('none')}
                    currentTime={currentTime}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
