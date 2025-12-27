/**
 * Whisper Transcription Service
 * Wrapper for OpenAI Whisper for local audio/video transcription
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
    TranscriptionOptions,
    TranscriptionResult,
    TranscriptionSegment,
    WhisperModel,
    WHISPER_MODELS,
    SUPPORTED_LANGUAGES,
} from './types.js';
import { ffmpegService, ffprobeService } from '../ffmpeg/index.js';

export class WhisperService {
    private pythonPath: string;
    private whisperInstalled: boolean | null = null;

    constructor(pythonPath: string = 'python3') {
        this.pythonPath = pythonPath;
    }

    /**
     * Check if Whisper is installed
     */
    async isInstalled(): Promise<boolean> {
        if (this.whisperInstalled !== null) {
            return this.whisperInstalled;
        }

        try {
            await this.runPython(['-c', 'import whisper; print(whisper.__version__)']);
            this.whisperInstalled = true;
            return true;
        } catch {
            this.whisperInstalled = false;
            return false;
        }
    }

    /**
     * Run Python command
     */
    private async runPython(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                cwd,
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('error', (error: Error) => {
                reject(new Error(`Python execution error: ${error.message}`));
            });

            proc.on('close', (code: number | null) => {
                if (code === 0) {
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                } else {
                    reject(new Error(`Python exited with code ${code}: ${stderr || stdout}`));
                }
            });
        });
    }

    /**
     * Transcribe audio/video file using Whisper
     */
    async transcribe(
        inputPath: string,
        options: TranscriptionOptions = {}
    ): Promise<TranscriptionResult> {
        const startTime = Date.now();

        // Verify file exists
        if (!fs.existsSync(inputPath)) {
            return {
                success: false,
                error: `File not found: ${inputPath}`,
            };
        }

        // Check if Whisper is installed
        if (!await this.isInstalled()) {
            return {
                success: false,
                error: 'Whisper is not installed. Run: pip install openai-whisper',
            };
        }

        const model = options.model || 'base';
        const outputDir = path.dirname(inputPath);
        const baseName = path.basename(inputPath, path.extname(inputPath));

        // Build the transcription script
        const script = this.buildTranscriptionScript(inputPath, options);

        try {
            const { stdout, stderr } = await this.runPython(['-c', script]);

            // Parse the JSON result
            const result = JSON.parse(stdout);

            const processingTime = Date.now() - startTime;

            // Generate subtitle files if requested
            let srtPath: string | undefined;
            let vttPath: string | undefined;

            if (result.segments && options.outputFormat !== 'text') {
                if (options.outputFormat === 'srt' || !options.outputFormat) {
                    srtPath = path.join(outputDir, `${baseName}.srt`);
                    await this.writeSRT(result.segments, srtPath);
                }
                if (options.outputFormat === 'vtt') {
                    vttPath = path.join(outputDir, `${baseName}.vtt`);
                    await this.writeVTT(result.segments, vttPath);
                }
            }

            return {
                success: true,
                text: result.text,
                segments: result.segments,
                language: result.language,
                languageProbability: result.language_probability,
                duration: result.duration,
                processingTime,
                srtPath,
                vttPath,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                processingTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Build Python script for transcription
     */
    private buildTranscriptionScript(inputPath: string, options: TranscriptionOptions): string {
        const model = options.model || 'base';
        const task = options.task || 'transcribe';
        const language = options.language ? `"${options.language}"` : 'None';
        const wordTimestamps = options.wordTimestamps ? 'True' : 'False';
        const temperature = options.temperature ?? 0;
        const initialPrompt = options.initialPrompt ? `"${options.initialPrompt.replace(/"/g, '\\"')}"` : 'None';

        return `
import whisper
import json
import sys

# Load model
model = whisper.load_model("${model}")

# Transcribe
result = model.transcribe(
    "${inputPath.replace(/\\/g, '\\\\')}",
    task="${task}",
    language=${language},
    word_timestamps=${wordTimestamps},
    temperature=${temperature},
    initial_prompt=${initialPrompt},
    verbose=False
)

# Format output
output = {
    "text": result["text"],
    "language": result.get("language", "unknown"),
    "segments": [
        {
            "id": seg["id"],
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"],
            "words": seg.get("words", []) if ${wordTimestamps} else []
        }
        for seg in result.get("segments", [])
    ]
}

print(json.dumps(output, ensure_ascii=False))
`.trim();
    }

    /**
     * Write SRT subtitle file
     */
    async writeSRT(segments: TranscriptionSegment[], outputPath: string): Promise<void> {
        const lines: string[] = [];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            lines.push(String(i + 1));
            lines.push(`${this.formatSRTTime(seg.start)} --> ${this.formatSRTTime(seg.end)}`);
            lines.push(seg.text.trim());
            lines.push('');
        }

        await fs.promises.writeFile(outputPath, lines.join('\n'), 'utf-8');
    }

    /**
     * Write VTT subtitle file
     */
    async writeVTT(segments: TranscriptionSegment[], outputPath: string): Promise<void> {
        const lines: string[] = ['WEBVTT', ''];

        for (const seg of segments) {
            lines.push(`${this.formatVTTTime(seg.start)} --> ${this.formatVTTTime(seg.end)}`);
            lines.push(seg.text.trim());
            lines.push('');
        }

        await fs.promises.writeFile(outputPath, lines.join('\n'), 'utf-8');
    }

    /**
     * Format time for SRT (HH:MM:SS,mmm)
     */
    private formatSRTTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    /**
     * Format time for VTT (HH:MM:SS.mmm)
     */
    private formatVTTTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    /**
     * Transcribe video by extracting audio first
     */
    async transcribeVideo(
        videoPath: string,
        options: TranscriptionOptions = {}
    ): Promise<TranscriptionResult> {
        // Extract audio to temp file
        const tempAudioPath = videoPath.replace(/\.[^.]+$/, '_audio_temp.wav');

        try {
            const extractResult = await ffmpegService.extractAudio(videoPath, tempAudioPath, 'wav');

            if (!extractResult.success) {
                return {
                    success: false,
                    error: `Failed to extract audio: ${extractResult.error}`,
                };
            }

            // Transcribe the extracted audio
            const result = await this.transcribe(tempAudioPath, options);

            // Clean up temp file
            try {
                await fs.promises.unlink(tempAudioPath);
            } catch {
                // Ignore cleanup errors
            }

            return result;
        } catch (error) {
            // Clean up temp file on error
            try {
                await fs.promises.unlink(tempAudioPath);
            } catch {
                // Ignore cleanup errors
            }

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * List available Whisper models with info
     */
    listModels(): typeof WHISPER_MODELS {
        return WHISPER_MODELS;
    }

    /**
     * List supported languages
     */
    listLanguages(): typeof SUPPORTED_LANGUAGES {
        return SUPPORTED_LANGUAGES;
    }

    /**
     * Detect language of audio file
     */
    async detectLanguage(inputPath: string, model: WhisperModel = 'base'): Promise<{ language: string; probability: number } | null> {
        const script = `
import whisper
import json

model = whisper.load_model("${model}")
audio = whisper.load_audio("${inputPath.replace(/\\/g, '\\\\')}")
audio = whisper.pad_or_trim(audio)
mel = whisper.log_mel_spectrogram(audio).to(model.device)
_, probs = model.detect_language(mel)
language = max(probs, key=probs.get)
print(json.dumps({"language": language, "probability": probs[language]}))
`.trim();

        try {
            const { stdout } = await this.runPython(['-c', script]);
            return JSON.parse(stdout);
        } catch {
            return null;
        }
    }
}

export const whisperService = new WhisperService();
