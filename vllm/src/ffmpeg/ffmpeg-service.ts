/**
 * FFmpeg Service
 * Wrapper for ffmpeg to perform various media operations
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
    FFmpegResult,
    ConversionOptions,
    TrimOptions,
    ThumbnailOptions,
    CompressOptions,
    GifOptions,
    ConcatOptions,
    AudioMergeOptions,
    SubtitleEmbedOptions,
    ENCODING_PRESETS,
    EncodingPreset,
} from './types.js';
import { ffprobeService } from './ffprobe-service.js';

export class FFmpegService {
    private ffmpegPath: string;

    constructor(ffmpegPath: string = 'ffmpeg') {
        this.ffmpegPath = ffmpegPath;
    }

    /**
     * Execute ffmpeg command
     */
    private async runFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string; duration: number }> {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const process = spawn(this.ffmpegPath, args, {
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
                reject(new Error(`FFmpeg execution error: ${error.message}`));
            });

            process.on('close', (code) => {
                const duration = Date.now() - startTime;
                if (code === 0) {
                    resolve({ stdout, stderr, duration });
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
                }
            });
        });
    }

    /**
     * Generate a unique output filename
     */
    private generateOutputPath(inputPath: string, suffix: string, extension?: string): string {
        const dir = path.dirname(inputPath);
        const base = path.basename(inputPath, path.extname(inputPath));
        const ext = extension || path.extname(inputPath);
        const timestamp = Date.now();
        return path.join(dir, `${base}_${suffix}_${timestamp}${ext}`);
    }

    /**
     * Ensure output directory exists
     */
    private ensureOutputDir(outputPath: string): void {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // ============================================================================
    // Video Conversion
    // ============================================================================

    /**
     * Convert video to different format or apply encoding options
     */
    async convert(
        inputPath: string,
        outputPath?: string,
        options: ConversionOptions = {}
    ): Promise<FFmpegResult> {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: `Input file not found: ${inputPath}` };
        }

        const ext = options.outputFormat ? `.${options.outputFormat}` : path.extname(inputPath);
        const output = outputPath || this.generateOutputPath(inputPath, 'converted', ext);
        this.ensureOutputDir(output);

        const args: string[] = ['-i', inputPath, '-y'];

        // Video codec
        if (options.videoCodec) {
            args.push('-c:v', options.videoCodec);
        }
        if (options.removeVideo) {
            args.push('-vn');
        }

        // Audio codec
        if (options.audioCodec) {
            args.push('-c:a', options.audioCodec);
        }
        if (options.removeAudio) {
            args.push('-an');
        }

        // Bitrates
        if (options.videoBitrate) {
            args.push('-b:v', options.videoBitrate);
        }
        if (options.audioBitrate) {
            args.push('-b:a', options.audioBitrate);
        }

        // CRF (quality)
        if (options.crf !== undefined) {
            args.push('-crf', options.crf.toString());
        }

        // Preset
        if (options.preset) {
            args.push('-preset', options.preset);
        }

        // Resolution
        if (options.resolution) {
            args.push('-s', options.resolution);
        }

        // FPS
        if (options.fps) {
            args.push('-r', options.fps.toString());
        }

        args.push(output);

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: output,
                duration: result.duration,
                stderr: result.stderr,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Convert using a preset
     */
    async convertWithPreset(
        inputPath: string,
        presetName: string,
        outputPath?: string
    ): Promise<FFmpegResult> {
        const preset = ENCODING_PRESETS[presetName];
        if (!preset) {
            return { success: false, error: `Unknown preset: ${presetName}. Available: ${Object.keys(ENCODING_PRESETS).join(', ')}` };
        }

        return this.convert(inputPath, outputPath, {
            videoCodec: preset.videoCodec,
            audioCodec: preset.audioCodec,
            crf: preset.crf,
            preset: preset.preset,
            audioBitrate: preset.audioBitrate,
        });
    }

    // ============================================================================
    // Trimming / Cutting
    // ============================================================================

    /**
     * Trim video to specified time range
     */
    async trim(
        inputPath: string,
        options: TrimOptions,
        outputPath?: string
    ): Promise<FFmpegResult> {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: `Input file not found: ${inputPath}` };
        }

        const output = outputPath || this.generateOutputPath(inputPath, 'trimmed');
        this.ensureOutputDir(output);

        const args: string[] = ['-i', inputPath];

        // Start time
        args.push('-ss', options.startTime);

        // End time or duration
        if (options.endTime) {
            args.push('-to', options.endTime);
        } else if (options.duration) {
            args.push('-t', options.duration);
        }

        // Copy streams without re-encoding (faster) if requested
        if (options.copyStreams !== false) {
            args.push('-c', 'copy');
        }

        args.push('-y', output);

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: output,
                duration: result.duration,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // Audio Extraction
    // ============================================================================

    /**
     * Extract audio from video file
     */
    async extractAudio(
        inputPath: string,
        outputPath?: string,
        format: string = 'mp3'
    ): Promise<FFmpegResult> {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: `Input file not found: ${inputPath}` };
        }

        const output = outputPath || this.generateOutputPath(inputPath, 'audio', `.${format}`);
        this.ensureOutputDir(output);

        const args: string[] = [
            '-i', inputPath,
            '-vn',  // No video
            '-acodec', format === 'mp3' ? 'libmp3lame' : (format === 'aac' ? 'aac' : 'copy'),
            '-y',
            output,
        ];

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: output,
                duration: result.duration,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // Thumbnail Extraction
    // ============================================================================

    /**
     * Extract thumbnail(s) from video
     */
    async extractThumbnails(
        inputPath: string,
        outputDir: string,
        options: ThumbnailOptions = {}
    ): Promise<FFmpegResult> {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: `Input file not found: ${inputPath}` };
        }

        this.ensureOutputDir(path.join(outputDir, 'dummy'));
        const baseName = path.basename(inputPath, path.extname(inputPath));
        const outputPaths: string[] = [];

        // Single thumbnail at specific timestamp
        if (options.timestamp && !options.count) {
            const output = path.join(outputDir, `${baseName}_thumb.jpg`);
            const args: string[] = [
                '-ss', options.timestamp,
                '-i', inputPath,
                '-vframes', '1',
            ];

            if (options.width) {
                args.push('-vf', `scale=${options.width}:-1`);
            }
            if (options.quality) {
                args.push('-q:v', options.quality.toString());
            }

            args.push('-y', output);

            try {
                await this.runFFmpeg(args);
                outputPaths.push(output);
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
        }
        // Multiple thumbnails
        else if (options.count && options.count > 1) {
            const duration = await ffprobeService.getDuration(inputPath);
            const interval = options.interval || (duration / (options.count + 1));

            for (let i = 0; i < options.count; i++) {
                const timestamp = (i + 1) * interval;
                const output = path.join(outputDir, `${baseName}_thumb_${i + 1}.jpg`);

                const args: string[] = [
                    '-ss', timestamp.toString(),
                    '-i', inputPath,
                    '-vframes', '1',
                ];

                if (options.width) {
                    args.push('-vf', `scale=${options.width}:-1`);
                }
                if (options.quality) {
                    args.push('-q:v', options.quality.toString());
                }

                args.push('-y', output);

                try {
                    await this.runFFmpeg(args);
                    outputPaths.push(output);
                } catch (error) {
                    // Continue with other thumbnails
                    console.error(`Failed to extract thumbnail at ${timestamp}s: ${error}`);
                }
            }
        }

        return {
            success: outputPaths.length > 0,
            outputPaths,
        };
    }

    // ============================================================================
    // Compression
    // ============================================================================

    /**
     * Compress video to reduce file size
     */
    async compress(
        inputPath: string,
        outputPath?: string,
        options: CompressOptions = {}
    ): Promise<FFmpegResult> {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: `Input file not found: ${inputPath}` };
        }

        const output = outputPath || this.generateOutputPath(inputPath, 'compressed');
        this.ensureOutputDir(output);

        // Determine CRF based on quality setting
        let crf: number;
        switch (options.quality) {
            case 'low': crf = 32; break;
            case 'medium': crf = 28; break;
            case 'high': crf = 23; break;
            case 'very_high': crf = 18; break;
            default: crf = 28;
        }

        const args: string[] = [
            '-i', inputPath,
            '-c:v', 'libx264',
            '-crf', crf.toString(),
            '-preset', 'medium',
            '-c:a', 'aac',
            '-b:a', '128k',
        ];

        if (options.maxBitrate) {
            args.push('-maxrate', options.maxBitrate, '-bufsize', options.maxBitrate);
        }

        args.push('-y', output);

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: output,
                duration: result.duration,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // GIF Creation
    // ============================================================================

    /**
     * Create GIF from video
     */
    async createGif(
        inputPath: string,
        outputPath?: string,
        options: GifOptions = {}
    ): Promise<FFmpegResult> {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: `Input file not found: ${inputPath}` };
        }

        const output = outputPath || this.generateOutputPath(inputPath, 'gif', '.gif');
        this.ensureOutputDir(output);

        const fps = options.fps || 10;
        const width = options.width || 480;

        // Build filter string
        let filter = `fps=${fps},scale=${width}:-1:flags=lanczos`;

        if (options.optimize !== false) {
            filter += ',split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse';
        }

        const args: string[] = ['-i', inputPath];

        if (options.startTime) {
            args.push('-ss', options.startTime);
        }
        if (options.duration) {
            args.push('-t', options.duration.toString());
        }

        args.push(
            '-vf', filter,
            '-loop', (options.loop ?? 0).toString(),
            '-y',
            output
        );

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: output,
                duration: result.duration,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // Concatenation
    // ============================================================================

    /**
     * Concatenate multiple videos
     */
    async concat(options: ConcatOptions): Promise<FFmpegResult> {
        // Verify all input files exist
        for (const file of options.inputFiles) {
            if (!fs.existsSync(file)) {
                return { success: false, error: `Input file not found: ${file}` };
            }
        }

        this.ensureOutputDir(options.outputFile);

        // Create concat file
        const concatFilePath = path.join(path.dirname(options.outputFile), '.concat_list.txt');
        const concatContent = options.inputFiles.map(f => `file '${f}'`).join('\n');
        fs.writeFileSync(concatFilePath, concatContent);

        const args: string[] = [
            '-f', 'concat',
            '-safe', '0',
            '-i', concatFilePath,
        ];

        if (!options.reEncode) {
            args.push('-c', 'copy');
        }

        args.push('-y', options.outputFile);

        try {
            const result = await this.runFFmpeg(args);
            // Clean up concat file
            fs.unlinkSync(concatFilePath);
            return {
                success: true,
                outputPath: options.outputFile,
                duration: result.duration,
            };
        } catch (error) {
            // Clean up concat file
            if (fs.existsSync(concatFilePath)) {
                fs.unlinkSync(concatFilePath);
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // Audio Merge
    // ============================================================================

    /**
     * Merge audio track into video
     */
    async mergeAudio(options: AudioMergeOptions): Promise<FFmpegResult> {
        if (!fs.existsSync(options.videoFile)) {
            return { success: false, error: `Video file not found: ${options.videoFile}` };
        }
        if (!fs.existsSync(options.audioFile)) {
            return { success: false, error: `Audio file not found: ${options.audioFile}` };
        }

        this.ensureOutputDir(options.outputFile);

        const args: string[] = [
            '-i', options.videoFile,
            '-i', options.audioFile,
        ];

        if (options.audioDelay) {
            args.push('-itsoffset', options.audioDelay.toString());
        }

        if (options.replaceAudio) {
            // Replace original audio
            args.push(
                '-map', '0:v',
                '-map', '1:a',
                '-c:v', 'copy',
                '-shortest'
            );
        } else {
            // Add as additional track
            args.push(
                '-map', '0',
                '-map', '1:a',
                '-c:v', 'copy'
            );
        }

        args.push('-y', options.outputFile);

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: options.outputFile,
                duration: result.duration,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // Subtitle Embedding
    // ============================================================================

    /**
     * Embed subtitles into video
     */
    async embedSubtitles(options: SubtitleEmbedOptions): Promise<FFmpegResult> {
        if (!fs.existsSync(options.videoFile)) {
            return { success: false, error: `Video file not found: ${options.videoFile}` };
        }
        if (!fs.existsSync(options.subtitleFile)) {
            return { success: false, error: `Subtitle file not found: ${options.subtitleFile}` };
        }

        this.ensureOutputDir(options.outputFile);

        const args: string[] = ['-i', options.videoFile];

        if (options.hardcode) {
            // Burn subtitles into video (requires re-encoding)
            let subtitleFilter = `subtitles='${options.subtitleFile.replace(/'/g, "\\'")}'`;

            // Add styling options
            const styleOptions: string[] = [];
            if (options.fontName) styleOptions.push(`FontName=${options.fontName}`);
            if (options.fontSize) styleOptions.push(`FontSize=${options.fontSize}`);
            if (options.fontColor) styleOptions.push(`PrimaryColour=${options.fontColor}`);
            if (options.outlineColor) styleOptions.push(`OutlineColour=${options.outlineColor}`);
            if (options.outlineWidth) styleOptions.push(`Outline=${options.outlineWidth}`);

            if (styleOptions.length > 0) {
                subtitleFilter += `:force_style='${styleOptions.join(',')}'`;
            }

            args.push(
                '-vf', subtitleFilter,
                '-c:a', 'copy'
            );
        } else {
            // Soft subtitles (embedded as separate track)
            args.push(
                '-i', options.subtitleFile,
                '-map', '0',
                '-map', '1',
                '-c', 'copy',
                '-c:s', 'mov_text'  // For MP4 container
            );

            if (options.language) {
                args.push('-metadata:s:s:0', `language=${options.language}`);
            }
            if (options.title) {
                args.push('-metadata:s:s:0', `title=${options.title}`);
            }
        }

        args.push('-y', options.outputFile);

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: options.outputFile,
                duration: result.duration,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // Resize
    // ============================================================================

    /**
     * Resize video to new resolution
     */
    async resize(
        inputPath: string,
        width: number,
        height?: number,
        outputPath?: string
    ): Promise<FFmpegResult> {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: `Input file not found: ${inputPath}` };
        }

        const output = outputPath || this.generateOutputPath(inputPath, `${width}p`);
        this.ensureOutputDir(output);

        // -1 maintains aspect ratio
        const resolution = height ? `${width}:${height}` : `${width}:-1`;

        const args: string[] = [
            '-i', inputPath,
            '-vf', `scale=${resolution}`,
            '-c:a', 'copy',
            '-y',
            output,
        ];

        try {
            const result = await this.runFFmpeg(args);
            return {
                success: true,
                outputPath: output,
                duration: result.duration,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * List available encoding presets
     */
    listPresets(): EncodingPreset[] {
        return Object.values(ENCODING_PRESETS);
    }

    /**
     * Check if FFmpeg is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            await this.runFFmpeg(['-version']);
            return true;
        } catch {
            return false;
        }
    }
}

export const ffmpegService = new FFmpegService();
