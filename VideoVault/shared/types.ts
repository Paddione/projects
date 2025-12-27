export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  fps: number;
  aspectRatio: string;
}

export interface VideoThumbnail {
  dataUrl: string;
  generated: boolean;
  timestamp: string;
}

export interface VideoCategories {
  [type: string]: string[];
  age: string[];
  physical: string[];
  ethnicity: string[];
  relationship: string[];
  acts: string[];
  setting: string[];
  quality: string[];
  performer: string[];
}

export interface CustomCategories {
  [type: string]: string[];
}

export interface FilterPreset {
  name: string;
  categories: string[];
  searchQuery: string;
  dateRange: { startDate: string; endDate: string };
  fileSizeRange: { min: number; max: number };
  durationRange: { min: number; max: number };
  createdAt: string;
  updatedAt: string;
}

export interface VideoShape {
  id: string;
  filename: string;
  displayName: string;
  path: string;
  size: number;
  lastModified: string;
  categories: VideoCategories;
  customCategories: CustomCategories;
  metadata: VideoMetadata;
  thumbnail?: VideoThumbnail | null;
  rootKey?: string;
}
