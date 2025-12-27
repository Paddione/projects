/**
 * FFprobe Service
 * Wrapper for ffprobe to extract media file information
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
    MediaInfo,
    VideoStream,
    AudioStream,
    SubtitleStream,
    FFprobeResult,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS,
} from './types.js';

export class FFprobeService {
    private ffprobePath: string;

    constructor(ffprobePath: string = 'ffprobe') {
        this.ffprobePath = ffprobePath;
    }

    /**
     * Execute ffprobe command and return parsed JSON output
     */
    private async runFFprobe(args: string[]): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const process = spawn(this.ffprobePath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('error', (error) => {
                reject(new Error(`FFprobe execution error: ${error.message}`));
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
                }
            });
        });
    }

    /**
     * Get detailed information about a media file
     */
    async getMediaInfo(filePath: string): Promise<FFprobeResult> {
        // Verify file exists
        if (!fs.existsSync(filePath)) {
            return {
                success: false,
                error: `File not found: ${filePath}`,
            };
        }

        try {
            const args = [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                filePath,
            ];

            const { stdout } = await this.runFFprobe(args);
            const data = JSON.parse(stdout);

            // Parse streams by type
            const videoStreams: VideoStream[] = [];
            const audioStreams: AudioStream[] = [];
            const subtitleStreams: SubtitleStream[] = [];

            for (const stream of data.streams || []) {
                if (stream.codec_type === 'video') {
                    videoStreams.push({
                        index: stream.index,
                        codec_name: stream.codec_name,
                        codec_long_name: stream.codec_long_name,
                        width: stream.width,
                        height: stream.height,
                        display_aspect_ratio: stream.display_aspect_ratio,
                        pix_fmt: stream.pix_fmt,
                        r_frame_rate: stream.r_frame_rate,
                        avg_frame_rate: stream.avg_frame_rate,
                        duration: parseFloat(stream.duration),
                        bit_rate: parseInt(stream.bit_rate),
                        nb_frames: parseInt(stream.nb_frames),
                    });
                } else if (stream.codec_type === 'audio') {
                    audioStreams.push({
                        index: stream.index,
                        codec_name: stream.codec_name,
                        codec_long_name: stream.codec_long_name,
                        sample_rate: stream.sample_rate,
                        channels: stream.channels,
                        channel_layout: stream.channel_layout,
                        bit_rate: parseInt(stream.bit_rate),
                        duration: parseFloat(stream.duration),
                    });
                } else if (stream.codec_type === 'subtitle') {
                    subtitleStreams.push({
                        index: stream.index,
                        codec_name: stream.codec_name,
                        codec_long_name: stream.codec_long_name,
                        language: stream.tags?.language,
                        title: stream.tags?.title,
                    });
                }
            }

            const mediaInfo: MediaInfo = {
                format: {
                    filename: data.format.filename,
                    format_name: data.format.format_name,
                    format_long_name: data.format.format_long_name,
                    duration: parseFloat(data.format.duration),
                    size: parseInt(data.format.size),
                    bit_rate: parseInt(data.format.bit_rate),
                    nb_streams: data.format.nb_streams,
                    tags: data.format.tags,
                },
                video_streams: videoStreams,
                audio_streams: audioStreams,
                subtitle_streams: subtitleStreams,
            };

            return {
                success: true,
                info: mediaInfo,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Get duration of a media file in seconds
     */
    async getDuration(filePath: string): Promise<number> {
        const result = await this.getMediaInfo(filePath);
        if (!result.success || !result.info) {
            throw new Error(result.error || 'Failed to get media duration');
        }
        return result.info.format.duration;
    }

    /**
     * Get video resolution as { width, height }
     */
    async getResolution(filePath: string): Promise<{ width: number; height: number } | null> {
        const result = await this.getMediaInfo(filePath);
        if (!result.success || !result.info || result.info.video_streams.length === 0) {
            return null;
        }
        const video = result.info.video_streams[0];
        return { width: video.width, height: video.height };
    }

    /**
     * Get framerate of video
     */
    async getFramerate(filePath: string): Promise<number | null> {
        const result = await this.getMediaInfo(filePath);
        if (!result.success || !result.info || result.info.video_streams.length === 0) {
            return null;
        }
        const fps = result.info.video_streams[0].r_frame_rate;
        const [num, den] = fps.split('/').map(Number);
        return den ? num / den : num;
    }

    /**
     * Check if file is a video
     */
    isVideoFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return VIDEO_EXTENSIONS.includes(ext);
    }

    /**
     * Check if file is audio
     */
    isAudioFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return AUDIO_EXTENSIONS.includes(ext);
    }

    /**
     * Get a human-readable summary of media info
     */
    formatMediaSummary(info: MediaInfo): string {
        const lines: string[] = [];

        // Format info
        lines.push(`📁 **File**: ${path.basename(info.format.filename)}`);
        lines.push(`📦 **Format**: ${info.format.format_long_name}`);
        lines.push(`⏱️ **Duration**: ${this.formatDuration(info.format.duration)}`);
        lines.push(`💾 **Size**: ${this.formatSize(info.format.size)}`);
        lines.push(`📊 **Bitrate**: ${this.formatBitrate(info.format.bit_rate)}`);

        // Video streams
        if (info.video_streams.length > 0) {
            lines.push('\n**Video Streams:**');
            for (const v of info.video_streams) {
                const fps = this.parseFramerate(v.r_frame_rate);
                lines.push(`  • Stream ${v.index}: ${v.codec_name.toUpperCase()} ${v.width}x${v.height} @ ${fps.toFixed(2)} fps`);
            }
        }

        // Audio streams
        if (info.audio_streams.length > 0) {
            lines.push('\n**Audio Streams:**');
            for (const a of info.audio_streams) {
                lines.push(`  • Stream ${a.index}: ${a.codec_name.toUpperCase()} ${a.sample_rate}Hz ${a.channels}ch`);
            }
        }

        // Subtitle streams
        if (info.subtitle_streams.length > 0) {
            lines.push('\n**Subtitle Streams:**');
            for (const s of info.subtitle_streams) {
                const lang = s.language || 'unknown';
                lines.push(`  • Stream ${s.index}: ${s.codec_name} (${lang})`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Format duration in HH:MM:SS
     */
    formatDuration(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    /**
     * Format file size
     */
    formatSize(bytes: number): string {
        if (!bytes || isNaN(bytes)) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return `${bytes.toFixed(2)} ${units[i]}`;
    }

    /**
     * Format bitrate
     */
    formatBitrate(bps: number): string {
        if (!bps || isNaN(bps)) return '0 bps';
        if (bps >= 1000000) {
            return `${(bps / 1000000).toFixed(2)} Mbps`;
        } else if (bps >= 1000) {
            return `${(bps / 1000).toFixed(2)} Kbps`;
        }
        return `${bps} bps`;
    }

    /**
     * Parse framerate string to number
     */
    private parseFramerate(fps: string): number {
        if (!fps) return 0;
        const [num, den] = fps.split('/').map(Number);
        return den ? num / den : num;
    }
}

export const ffprobeService = new FFprobeService();
