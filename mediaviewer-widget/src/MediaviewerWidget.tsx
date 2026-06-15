import { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { VideoPlayer } from '@videovault-player';
import { HelpVideoPicker } from './HelpVideoPicker';
import type { MediaviewerHandle, MediaviewerWidgetProps, VideoSource, PlayerState } from '@videovault-player';

export const MediaviewerWidget = forwardRef<MediaviewerHandle, MediaviewerWidgetProps>(function MediaviewerWidget(
  { videos, onSelect, onEnded, onError },
  ref,
) {
  const [current, setCurrent] = useState<VideoSource | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [currentTime, setCurrentTime] = useState(0);

  const handleSelect = useCallback((videoId: string) => {
    const video = videos.find((v) => v.id === videoId) || null;
    setCurrent(video);
    onSelect(videoId);
  }, [videos, onSelect]);

  useImperativeHandle(ref, () => ({
    playVideo: (id: string) => {
      handleSelect(id);
    },
    setPlaylist: (_videos: VideoSource[], initialId?: string) => {
      if (initialId) {
        const v = _videos.find((x) => x.id === initialId);
        if (v) setCurrent(v);
      }
    },
    play: () => {},
    pause: () => {},
    seek: (time: number) => {
      setCurrentTime(time);
    },
    getState: () => ({
      current,
      state: playerState,
      currentTime,
    }),
  }), [current, playerState, currentTime, handleSelect]);

  return (
    <div data-testid="mediaviewer-widget">
      <VideoPlayer
        source={current}
        onEnded={(id) => onEnded?.(id)}
        onError={(id, msg) => onError?.(id, msg)}
      />
      <HelpVideoPicker videos={videos} onSelect={handleSelect} />
    </div>
  );
});
