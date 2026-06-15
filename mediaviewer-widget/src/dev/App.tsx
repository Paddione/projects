import { MediaviewerWidget } from '../MediaviewerWidget';
import type { VideoSource } from '@videovault-player';

const exampleVideos: VideoSource[] = [
  { id: 'v1', url: 'https://example.com/help1.mp4', title: 'How to use VideoVault', duration: 60 },
  { id: 'v2', url: 'https://example.com/help2.mp4', title: 'Managing categories', duration: 90 },
  { id: 'v3', url: 'https://example.com/help3.mp4', title: 'Batch operations', duration: 120 },
];

export function App() {
  return (
    <div>
      <h1>Mediaviewer Widget – Dev Harness</h1>
      <MediaviewerWidget
        videos={exampleVideos}
        onSelect={(id) => console.log('Selected:', id)}
      />
    </div>
  );
}
