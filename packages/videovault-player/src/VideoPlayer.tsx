import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import React from 'react';
import { useVideoPlayer } from './useVideoPlayer';
import type { VideoPlayerProps, CaptureFrameFn, MediaviewerHandle, VideoSource } from './types';
import { defaultCaptureFrame } from './capture-frame';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const VideoPlayer = forwardRef<MediaviewerHandle, VideoPlayerProps & { externalVideoRef?: React.RefObject<HTMLVideoElement | null> }>(function VideoPlayer({
  source,
  playlist: playlistProp,
  captureFrame,
  showControls = true,
  onPrev,
  onNext,
  onSelect,
  onEnded,
  onError: onErrorProp,
  externalVideoRef,
}, ref) {
  const playlist: VideoSource[] = source && playlistProp
    ? playlistProp
    : source
    ? [source]
    : [];
  const { videoRef, current, state, currentTime, duration, volume, isMuted, playbackRate, buffered, controls, videoHandlers } =
    useVideoPlayer({
      playlist,
      initialVideoId: source?.id,
      onSelect,
      onEnded,
      onError: onErrorProp,
      videoRef: externalVideoRef,
    });

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTimeDisplay, setScrubTimeDisplay] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const isScrubbingRef = useRef(false);
  const scrubTimeRef = useRef(0);
  const overlayTimer = useRef<number | null>(null);

  const captureFn: CaptureFrameFn = captureFrame || defaultCaptureFrame;

  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    setShowOverlay(true);
    if (overlayTimer.current) window.clearTimeout(overlayTimer.current);
    overlayTimer.current = window.setTimeout(() => setShowOverlay(false), 3000);
    return () => {
      if (overlayTimer.current) window.clearTimeout(overlayTimer.current);
    };
  }, [current?.id]);

  useEffect(() => {
    if (overlayTimer.current) window.clearTimeout(overlayTimer.current);
    const h = () => {
      setShowOverlay(true);
      if (overlayTimer.current) window.clearTimeout(overlayTimer.current);
      overlayTimer.current = window.setTimeout(() => setShowOverlay(false), 3000);
    };
    document.addEventListener('mousemove', h);
    return () => document.removeEventListener('mousemove', h);
  }, []);

  const requestPreview = useCallback((tSec: number) => {
    const src = source?.url;
    if (!src) return;
    const whole = Math.max(0, Math.floor(tSec));
    setPreviewTime(whole);
    void captureFn(src, whole).then((url) => {
      setPreviewUrl(url);
    }).catch(() => {});
  }, [source?.url, captureFn]);

  useImperativeHandle(ref, () => ({
    playVideo: controls.playVideo,
    setPlaylist: controls.setPlaylist,
    play: controls.play,
    pause: controls.pause,
    seek: controls.seek,
    getState: () => ({
      current,
      state,
      currentTime,
    }),
  }), [controls, current, state, currentTime]);

  if (!source) {
    return null;
  }

  const formatTime = (t: number): string => {
    if (!Number.isFinite(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveTime = isScrubbing ? scrubTimeDisplay : currentTime;
  const effectiveDuration = duration > 0 ? duration : 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-black">
      <div className="relative bg-black flex-1 flex items-center justify-center">
        <video
          key={current?.id}
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className="w-full h-full object-contain bg-black"
          src={current?.url}
          poster={source.poster}
          data-testid="video-player"
          preload="metadata"
          playsInline
          onTimeUpdate={videoHandlers.onTimeUpdate}
          onLoadedMetadata={videoHandlers.onLoadedMetadata}
          onProgress={videoHandlers.onProgress}
          onPlay={videoHandlers.onPlay}
          onPause={videoHandlers.onPause}
          onEnded={videoHandlers.onEnded}
          onError={videoHandlers.onError}
        />

        <div className="absolute top-3 left-3">
          <span className="text-white text-sm font-medium" data-testid="text-video-title">
            {source.title}
          </span>
        </div>
      </div>

      {showControls && (
        <div className="bg-gradient-to-t from-black to-transparent p-4 z-10 w-full">
          <div className="space-y-2">
            <div
              className="relative w-full"
              data-testid="progress-area"
              onMouseMove={(e) => {
                if (!source) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                const ratio = rect.width > 0 ? x / rect.width : 0;
                const d = effectiveDuration > 0 ? effectiveDuration : 0;
                const t = d * ratio;
                requestPreview(t);
              }}
              onMouseLeave={() => { setPreviewTime(null); setPreviewUrl(null); }}
              ref={previewContainerRef}
            >
              {previewTime !== null && (
                <div
                  className="absolute -top-28 flex flex-col items-center"
                  data-testid="thumbnail-preview"
                >
                  <div className="pointer-events-none rounded border border-white/20 shadow-lg overflow-hidden bg-black">
                    {previewUrl ? (
                      <img src={previewUrl} alt="preview" className="w-40 h-24 object-cover" />
                    ) : (
                      <div className="w-40 h-24 bg-white/10" />
                    )}
                    <div className="w-40 text-center text-xs text-white py-1 bg-black/70">
                      {formatTime(previewTime)}
                    </div>
                  </div>
                </div>
              )}

              <input
                type="range"
                min={0}
                max={effectiveDuration || 1}
                step={0.1}
                value={effectiveTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  isScrubbingRef.current = true;
                  scrubTimeRef.current = val;
                  setScrubTimeDisplay(val);
                  setIsScrubbing(true);
                }}
                onMouseUp={() => {
                  if (isScrubbingRef.current) {
                    controls.seek(scrubTimeRef.current);
                    isScrubbingRef.current = false;
                    setIsScrubbing(false);
                  }
                }}
                onTouchEnd={() => {
                  if (isScrubbingRef.current) {
                    controls.seek(scrubTimeRef.current);
                    isScrubbingRef.current = false;
                    setIsScrubbing(false);
                  }
                }}
                className="w-full"
                data-testid="slider-progress"
                aria-label="Seek"
              />
            </div>

            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                {onPrev && (
                  <button
                    onClick={onPrev}
                    data-testid="button-skip-back"
                    className="text-white hover:bg-white/20 rounded p-1"
                  >
                    Prev
                  </button>
                )}
                <button
                  onClick={controls.toggle}
                  data-testid="button-play-pause"
                  className="text-white hover:bg-white/20 rounded p-1"
                >
                  {state === 'playing' ? 'Pause' : 'Play'}
                </button>
                {onNext && (
                  <button
                    onClick={onNext}
                    data-testid="button-skip-forward"
                    className="text-white hover:bg-white/20 rounded p-1"
                  >
                    Next
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-xs sm:text-sm" data-testid="text-time">
                  {formatTime(effectiveTime)} / {formatTime(effectiveDuration)}
                </span>

                <select
                  value={playbackRate}
                  onChange={(e) => controls.setRate(parseFloat(e.target.value))}
                  className="bg-transparent text-white text-xs"
                  aria-label="Playback speed"
                >
                  {SPEED_OPTIONS.map((s) => (
                    <option key={s} value={s} className="text-black">
                      {s}x
                    </option>
                  ))}
                </select>

                <button
                  onClick={controls.toggleMute}
                  data-testid="button-mute"
                  className="text-white hover:bg-white/20 rounded p-1"
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => controls.setVolume(parseFloat(e.target.value))}
                  className="w-20"
                  data-testid="slider-volume"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
