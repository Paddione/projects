import type { VideoSource } from '@videovault-player';

interface HelpVideoPickerProps {
  videos: VideoSource[];
  onSelect: (videoId: string) => void;
}

export function HelpVideoPicker({ videos, onSelect }: HelpVideoPickerProps) {
  return (
    <div data-testid="help-video-picker">
      {videos.map((video) => (
        <button
          key={video.id}
          onClick={() => onSelect(video.id)}
          data-testid={`picker-item-${video.id}`}
        >
          {video.title}
        </button>
      ))}
    </div>
  );
}
