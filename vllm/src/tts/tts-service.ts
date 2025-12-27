/**
 * Text-to-Speech Service
 * Wrapper for Coqui TTS with XTTSv2 for voice synthesis and cloning
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import {
    VoiceModel,
    VoiceModelCreate,
    TTSOptions,
    TTSResult,
    VoiceTrainResult,
    VoiceCloneOptions,
    TTS_LANGUAGES,
    DEFAULT_TTS_OPTIONS,
} from './types.js';

export class TTSService {
    private pythonPath: string;
    private modelsDirectory: string;
    private outputDirectory: string;
    private ttsInstalled: boolean | null = null;

    constructor(
        modelsDirectory: string = '/home/patrick/projects/vllm/voice-models',
        outputDirectory: string = '/home/patrick/projects/vllm/tts-output',
        pythonPath: string = 'python3'
    ) {
        this.modelsDirectory = modelsDirectory;
        this.outputDirectory = outputDirectory;
        this.pythonPath = pythonPath;
    }

    /**
     * Initialize directories
     */
    private async ensureDirectories(): Promise<void> {
        for (const dir of [this.modelsDirectory, this.outputDirectory]) {
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }
        }
    }

    /**
     * Check if Coqui TTS is installed
     */
    async isInstalled(): Promise<boolean> {
        if (this.ttsInstalled !== null) {
            return this.ttsInstalled;
        }

        try {
            await this.runPython(['-c', 'from TTS.api import TTS; print("ok")']);
            this.ttsInstalled = true;
            return true;
        } catch {
            this.ttsInstalled = false;
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
     * Synthesize speech from text
     */
    async synthesize(
        text: string,
        outputPath?: string,
        options: TTSOptions = {}
    ): Promise<TTSResult> {
        const startTime = Date.now();

        try {
            await this.ensureDirectories();

            if (!await this.isInstalled()) {
                return {
                    success: false,
                    error: 'Coqui TTS is not installed. Run: pip install TTS',
                };
            }

            const language = options.language || DEFAULT_TTS_OPTIONS.language;
            const speed = options.speed || DEFAULT_TTS_OPTIONS.speed;
            const format = options.outputFormat || DEFAULT_TTS_OPTIONS.outputFormat;

            // Generate output filename if not provided
            const output = outputPath || path.join(
                this.outputDirectory,
                `tts_${Date.now()}.${format}`
            );

            // Build TTS script
            let script: string;

            if (options.voiceModelId) {
                // Use custom voice model
                const model = await this.getVoiceModel(options.voiceModelId);
                if (!model) {
                    return {
                        success: false,
                        error: `Voice model not found: ${options.voiceModelId}`,
                    };
                }

                script = this.buildClonedVoiceScript(text, model, output, language, speed);
            } else {
                // Use default voice
                script = this.buildDefaultVoiceScript(text, output, language, speed);
            }

            const { stderr } = await this.runPython(['-c', script]);

            // Check if output file was created
            if (!fs.existsSync(output)) {
                return {
                    success: false,
                    error: 'TTS failed to generate audio file',
                    processingTime: Date.now() - startTime,
                };
            }

            // Get audio duration (approximate)
            const stats = await fs.promises.stat(output);
            const sampleRate = options.sampleRate || DEFAULT_TTS_OPTIONS.sampleRate;
            const bytesPerSample = 2; // 16-bit audio
            const duration = stats.size / (sampleRate * bytesPerSample);

            return {
                success: true,
                audioPath: output,
                duration,
                processingTime: Date.now() - startTime,
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
     * Build script for default voice synthesis
     */
    private buildDefaultVoiceScript(
        text: string,
        outputPath: string,
        language: string,
        speed: number
    ): string {
        const escapedText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');

        return `
from TTS.api import TTS
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

# Generate speech
tts.tts_to_file(
    text="${escapedText}",
    file_path="${outputPath.replace(/\\/g, '\\\\')}",
    language="${language}",
    speed=${speed}
)
print("done")
`.trim();
    }

    /**
     * Build script for cloned voice synthesis
     */
    private buildClonedVoiceScript(
        text: string,
        model: VoiceModel,
        outputPath: string,
        language: string,
        speed: number
    ): string {
        const escapedText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');

        return `
from TTS.api import TTS
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

# Generate speech with cloned voice
tts.tts_to_file(
    text="${escapedText}",
    file_path="${outputPath.replace(/\\/g, '\\\\')}",
    speaker_wav="${model.sourceAudioPath?.replace(/\\/g, '\\\\') || ''}",
    language="${language}",
    speed=${speed}
)
print("done")
`.trim();
    }

    /**
     * Clone a voice from reference audio
     */
    async cloneVoice(options: VoiceCloneOptions, modelInfo: VoiceModelCreate): Promise<VoiceTrainResult> {
        const startTime = Date.now();

        try {
            await this.ensureDirectories();

            if (!await this.isInstalled()) {
                return {
                    success: false,
                    error: 'Coqui TTS is not installed. Run: pip install TTS',
                };
            }

            // Verify reference audio exists
            if (!fs.existsSync(options.referenceAudioPath)) {
                return {
                    success: false,
                    error: `Reference audio not found: ${options.referenceAudioPath}`,
                };
            }

            const modelId = randomUUID().substring(0, 8);
            const modelDir = path.join(this.modelsDirectory, modelId);
            await fs.promises.mkdir(modelDir, { recursive: true });

            // Copy reference audio to model directory
            const sourceAudioDest = path.join(modelDir, 'reference.wav');
            await fs.promises.copyFile(options.referenceAudioPath, sourceAudioDest);

            // Create model metadata
            const model: VoiceModel = {
                id: modelId,
                name: modelInfo.name,
                language: modelInfo.language || 'en',
                sampleRate: 22050,
                description: modelInfo.description,
                createdAt: new Date().toISOString(),
                isCustom: true,
                sourceAudioPath: sourceAudioDest,
            };

            // Save model metadata
            const metadataPath = path.join(modelDir, 'metadata.json');
            await fs.promises.writeFile(metadataPath, JSON.stringify(model, null, 2));

            return {
                success: true,
                model,
                processingTime: Date.now() - startTime,
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
     * List all voice models
     */
    async listVoiceModels(): Promise<VoiceModel[]> {
        await this.ensureDirectories();

        const entries = await fs.promises.readdir(this.modelsDirectory, { withFileTypes: true });
        const models: VoiceModel[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const metadataPath = path.join(this.modelsDirectory, entry.name, 'metadata.json');
                if (fs.existsSync(metadataPath)) {
                    try {
                        const model = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
                        models.push(model);
                    } catch {
                        // Skip invalid models
                    }
                }
            }
        }

        return models.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    /**
     * Get a specific voice model
     */
    async getVoiceModel(modelId: string): Promise<VoiceModel | null> {
        const metadataPath = path.join(this.modelsDirectory, modelId, 'metadata.json');

        if (!fs.existsSync(metadataPath)) {
            return null;
        }

        try {
            return JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
        } catch {
            return null;
        }
    }

    /**
     * Delete a voice model
     */
    async deleteVoiceModel(modelId: string): Promise<boolean> {
        const modelDir = path.join(this.modelsDirectory, modelId);

        if (!fs.existsSync(modelDir)) {
            return false;
        }

        try {
            await fs.promises.rm(modelDir, { recursive: true });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * List supported languages
     */
    listLanguages(): typeof TTS_LANGUAGES {
        return TTS_LANGUAGES;
    }
}

export const ttsService = new TTSService();
