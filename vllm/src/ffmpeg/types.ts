/**
 * FFmpeg Service Types
 * Type definitions for FFmpeg/FFprobe operations
 */

// ============================================================================
// Media Information Types
// ============================================================================

export interface VideoStream {
    index: number;
    codec_name: string;
    codec_long_name: string;
    width: number;
    height: number;
    display_aspect_ratio?: string;
    pix_fmt: string;
    r_frame_rate: string;
    avg_frame_rate: string;
    duration?: number;
    bit_rate?: number;
    nb_frames?: number;
}

export interface AudioStream {
    index: number;
    codec_name: string;
    codec_long_name: string;
    sample_rate: string;
    channels: number;
    channel_layout?: string;
    bit_rate?: number;
    duration?: number;
}

export interface SubtitleStream {
    index: number;
    codec_name: string;
    codec_long_name: string;
    language?: string;
    title?: string;
}

export interface MediaFormat {
    filename: string;
    format_name: string;
    format_long_name: string;
    duration: number;
    size: number;
    bit_rate: number;
    nb_streams: number;
    tags?: Record<string, string>;
}

export interface MediaInfo {
    format: MediaFormat;
    video_streams: VideoStream[];
    audio_streams: AudioStream[];
    subtitle_streams: SubtitleStream[];
}

// ============================================================================
// Operation Types
// ============================================================================

export interface ConversionOptions {
    outputFormat?: string;
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    crf?: number;
    preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
    resolution?: string;
    fps?: number;
    removeAudio?: boolean;
    removeVideo?: boolean;
}

export interface TrimOptions {
    startTime: string;  // HH:MM:SS or seconds
    endTime?: string;   // HH:MM:SS or seconds
    duration?: string;  // HH:MM:SS or seconds
    copyStreams?: boolean;
}

export interface ThumbnailOptions {
    timestamp?: string;  // HH:MM:SS or seconds
    count?: number;      // Number of thumbnails to extract
    interval?: number;   // Seconds between thumbnails
    width?: number;
    height?: number;
    quality?: number;    // 1-31 for JPEG (lower is better)
}

export interface CompressOptions {
    targetSizeMB?: number;
    quality?: 'low' | 'medium' | 'high' | 'very_high';
    maxBitrate?: string;
    twoPass?: boolean;
}

export interface GifOptions {
    startTime?: string;
    duration?: number;
    fps?: number;
    width?: number;
    loop?: number;       // 0 = infinite loop
    optimize?: boolean;
}

export interface ConcatOptions {
    inputFiles: string[];
    outputFile: string;
    reEncode?: boolean;
}

export interface AudioMergeOptions {
    videoFile: string;
    audioFile: string;
    outputFile: string;
    replaceAudio?: boolean;
    audioDelay?: number;  // Delay in seconds
}

export interface SubtitleEmbedOptions {
    videoFile: string;
    subtitleFile: string;
    outputFile: string;
    hardcode?: boolean;   // Burn into video
    language?: string;
    title?: string;
    fontName?: string;
    fontSize?: number;
    fontColor?: string;
    outlineColor?: string;
    outlineWidth?: number;
}

// ============================================================================
// Encoding Presets
// ============================================================================

export interface EncodingPreset {
    name: string;
    description: string;
    videoCodec: string;
    audioCodec: string;
    crf: number;
    preset: ConversionOptions['preset'];
    audioBitrate: string;
    additionalArgs?: string[];
}

export const ENCODING_PRESETS: Record<string, EncodingPreset> = {
    web: {
        name: 'web',
        description: 'Balanced quality for web streaming',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        crf: 23,
        preset: 'medium',
        audioBitrate: '128k',
    },
    quality: {
        name: 'quality',
        description: 'High quality, larger file size',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        crf: 18,
        preset: 'slow',
        audioBitrate: '192k',
    },
    fast: {
        name: 'fast',
        description: 'Quick encoding, lower quality',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        crf: 28,
        preset: 'veryfast',
        audioBitrate: '96k',
    },
    discord: {
        name: 'discord',
        description: 'Optimized for Discord (max 25MB)',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        crf: 30,
        preset: 'fast',
        audioBitrate: '64k',
    },
    twitter: {
        name: 'twitter',
        description: 'Optimized for Twitter/X',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        crf: 24,
        preset: 'medium',
        audioBitrate: '128k',
    },
    archive: {
        name: 'archive',
        description: 'Best quality for archival',
        videoCodec: 'libx265',
        audioCodec: 'aac',
        crf: 20,
        preset: 'slow',
        audioBitrate: '256k',
    },
};

// ============================================================================
// Result Types
// ============================================================================

export interface FFmpegResult {
    success: boolean;
    outputPath?: string;
    outputPaths?: string[];  // For operations that produce multiple files
    duration?: number;       // Processing time in ms
    stdout?: string;
    stderr?: string;
    error?: string;
}

export interface FFprobeResult {
    success: boolean;
    info?: MediaInfo;
    error?: string;
}

// ============================================================================
// Supported Formats
// ============================================================================

export const VIDEO_EXTENSIONS = [
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp'
];

export const AUDIO_EXTENSIONS = [
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.aiff'
];

export const SUBTITLE_EXTENSIONS = [
    '.srt', '.vtt', '.ass', '.ssa', '.sub', '.sbv'
];
