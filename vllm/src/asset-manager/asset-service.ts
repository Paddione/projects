/**
 * Asset Manager Service
 * Handles multi-variant asset generation and selection workflow
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
    AssetMetadata,
    AssetSession,
    GenerateVariantsOptions,
    SelectionOptions,
    GenerationResult,
    SelectionResult,
    DEFAULT_GENERATION_SETTINGS,
    ASSET_DIRECTORIES,
} from './types.js';

export class AssetManagerService {
    private baseDirectory: string;
    private stableDiffusionUrl: string;

    constructor(
        baseDirectory: string = '/home/patrick/projects/vllm/assets',
        stableDiffusionUrl: string = 'http://localhost:7860'
    ) {
        this.baseDirectory = baseDirectory;
        this.stableDiffusionUrl = stableDiffusionUrl;
    }

    /**
     * Ensure all required directories exist
     */
    private async ensureDirectories(): Promise<void> {
        const dirs = [
            path.join(this.baseDirectory, ASSET_DIRECTORIES.PENDING),
            path.join(this.baseDirectory, ASSET_DIRECTORIES.SELECTED),
            path.join(this.baseDirectory, ASSET_DIRECTORIES.REJECTED),
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }
        }
    }

    /**
     * Generate session directory path
     */
    private getSessionPath(sessionId: string): string {
        return path.join(this.baseDirectory, ASSET_DIRECTORIES.PENDING, sessionId);
    }

    /**
     * Generate multiple variants of an image
     */
    async generateVariants(options: GenerateVariantsOptions): Promise<GenerationResult> {
        const startTime = Date.now();

        try {
            await this.ensureDirectories();

            const sessionId = randomUUID().substring(0, 8);
            const sessionPath = this.getSessionPath(sessionId);
            await fs.promises.mkdir(sessionPath, { recursive: true });

            const count = options.count || DEFAULT_GENERATION_SETTINGS.variantCount;
            const width = options.width || DEFAULT_GENERATION_SETTINGS.width;
            const height = options.height || DEFAULT_GENERATION_SETTINGS.height;
            const steps = options.steps || DEFAULT_GENERATION_SETTINGS.steps;
            const cfgScale = options.cfgScale || DEFAULT_GENERATION_SETTINGS.cfgScale;
            const sampler = options.sampler || DEFAULT_GENERATION_SETTINGS.sampler;

            const variants: AssetMetadata[] = [];
            const baseSeed = options.seedStart || Math.floor(Math.random() * 2147483647);

            // Generate each variant
            for (let i = 0; i < count; i++) {
                const seed = baseSeed + i;
                const filename = `variant_${i + 1}_seed${seed}.png`;
                const filePath = path.join(sessionPath, filename);

                try {
                    // Call Stable Diffusion API
                    const response = await fetch(`${this.stableDiffusionUrl}/sdapi/v1/txt2img`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: options.prompt,
                            negative_prompt: options.negativePrompt || '',
                            width,
                            height,
                            steps,
                            cfg_scale: cfgScale,
                            sampler_name: sampler,
                            seed,
                            batch_size: 1,
                            n_iter: 1,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`SD API error: ${response.status}`);
                    }

                    const result = await response.json();

                    if (result.images && result.images.length > 0) {
                        // Decode base64 image and save
                        const imageData = Buffer.from(result.images[0], 'base64');
                        await fs.promises.writeFile(filePath, imageData);

                        const stats = await fs.promises.stat(filePath);

                        variants.push({
                            id: `${sessionId}_${i}`,
                            sessionId,
                            prompt: options.prompt,
                            negativePrompt: options.negativePrompt,
                            seed,
                            width,
                            height,
                            steps,
                            cfgScale,
                            sampler,
                            createdAt: new Date().toISOString(),
                            selected: false,
                            rejected: false,
                            filename,
                            relativePath: path.join(ASSET_DIRECTORIES.PENDING, sessionId, filename),
                            fileSize: stats.size,
                        });
                    }
                } catch (error) {
                    console.error(`Failed to generate variant ${i + 1}:`, error);
                    // Continue with other variants
                }
            }

            if (variants.length === 0) {
                // Clean up empty session directory
                await fs.promises.rmdir(sessionPath);
                return {
                    success: false,
                    error: 'Failed to generate any variants. Is Stable Diffusion running?',
                    processingTime: Date.now() - startTime,
                };
            }

            const session: AssetSession = {
                id: sessionId,
                prompt: options.prompt,
                negativePrompt: options.negativePrompt,
                settings: {
                    width,
                    height,
                    steps,
                    cfgScale,
                    sampler,
                    variantCount: count,
                    seedStart: baseSeed,
                },
                variants,
                createdAt: new Date().toISOString(),
                status: 'pending',
            };

            // Save session metadata
            const metadataPath = path.join(sessionPath, 'metadata.json');
            await fs.promises.writeFile(metadataPath, JSON.stringify(session, null, 2));

            return {
                success: true,
                session,
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
     * Select specific variants and move them to selected directory
     */
    async selectVariants(options: SelectionOptions): Promise<SelectionResult> {
        try {
            const sessionPath = this.getSessionPath(options.sessionId);
            const metadataPath = path.join(sessionPath, 'metadata.json');

            if (!fs.existsSync(metadataPath)) {
                return {
                    success: false,
                    error: `Session not found: ${options.sessionId}`,
                };
            }

            const session: AssetSession = JSON.parse(
                await fs.promises.readFile(metadataPath, 'utf-8')
            );

            const selectedPaths: string[] = [];
            const rejectedPaths: string[] = [];

            // Determine target directory structure
            const today = new Date().toISOString().split('T')[0];
            let targetBase: string;

            switch (options.organizationScheme) {
                case 'date':
                    targetBase = path.join(this.baseDirectory, ASSET_DIRECTORIES.SELECTED, today);
                    break;
                case 'prompt':
                    const promptSlug = session.prompt.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
                    targetBase = path.join(this.baseDirectory, ASSET_DIRECTORIES.SELECTED, promptSlug);
                    break;
                case 'flat':
                default:
                    targetBase = options.targetDirectory ||
                        path.join(this.baseDirectory, ASSET_DIRECTORIES.SELECTED);
            }

            await fs.promises.mkdir(targetBase, { recursive: true });
            const rejectedBase = path.join(this.baseDirectory, ASSET_DIRECTORIES.REJECTED, today);
            await fs.promises.mkdir(rejectedBase, { recursive: true });

            // Process each variant
            for (let i = 0; i < session.variants.length; i++) {
                const variant = session.variants[i];
                const sourcePath = path.join(this.baseDirectory, variant.relativePath);

                if (!fs.existsSync(sourcePath)) {
                    continue;
                }

                if (options.selectedIndices.includes(i)) {
                    // Move to selected
                    const targetPath = path.join(targetBase, variant.filename);
                    await fs.promises.rename(sourcePath, targetPath);
                    selectedPaths.push(targetPath);
                    session.variants[i].selected = true;
                } else {
                    // Move to rejected
                    const targetPath = path.join(rejectedBase, `${options.sessionId}_${variant.filename}`);
                    await fs.promises.rename(sourcePath, targetPath);
                    rejectedPaths.push(targetPath);
                    session.variants[i].rejected = true;
                }
            }

            // Update session status
            if (selectedPaths.length === session.variants.length) {
                session.status = 'selected';
            } else if (selectedPaths.length === 0) {
                session.status = 'rejected';
            } else {
                session.status = 'partial';
            }

            // Move metadata to appropriate location
            const finalMetadataPath = path.join(targetBase, `${options.sessionId}_metadata.json`);
            session.variants = session.variants.map(v => ({
                ...v,
                relativePath: v.selected
                    ? path.relative(this.baseDirectory, path.join(targetBase, v.filename))
                    : path.relative(this.baseDirectory, path.join(rejectedBase, `${options.sessionId}_${v.filename}`)),
            }));
            await fs.promises.writeFile(finalMetadataPath, JSON.stringify(session, null, 2));

            // Clean up session directory
            try {
                await fs.promises.unlink(metadataPath);
                await fs.promises.rmdir(sessionPath);
            } catch {
                // Ignore cleanup errors
            }

            return {
                success: true,
                selectedPaths,
                rejectedPaths,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * List all pending sessions
     */
    async listPendingSessions(): Promise<AssetSession[]> {
        await this.ensureDirectories();

        const pendingDir = path.join(this.baseDirectory, ASSET_DIRECTORIES.PENDING);
        const entries = await fs.promises.readdir(pendingDir, { withFileTypes: true });
        const sessions: AssetSession[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const metadataPath = path.join(pendingDir, entry.name, 'metadata.json');
                if (fs.existsSync(metadataPath)) {
                    try {
                        const session = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
                        sessions.push(session);
                    } catch {
                        // Skip invalid sessions
                    }
                }
            }
        }

        return sessions.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    /**
     * Get a specific session by ID
     */
    async getSession(sessionId: string): Promise<AssetSession | null> {
        const metadataPath = path.join(this.getSessionPath(sessionId), 'metadata.json');

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
     * Reject all variants in a session
     */
    async rejectSession(sessionId: string): Promise<SelectionResult> {
        const session = await this.getSession(sessionId);
        if (!session) {
            return {
                success: false,
                error: `Session not found: ${sessionId}`,
            };
        }

        return this.selectVariants({
            sessionId,
            selectedIndices: [], // Select none = reject all
        });
    }

    /**
     * Clean up old rejected assets
     */
    async cleanupRejected(olderThanDays: number = 30): Promise<{ deleted: number; freedBytes: number }> {
        const rejectedDir = path.join(this.baseDirectory, ASSET_DIRECTORIES.REJECTED);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        let deleted = 0;
        let freedBytes = 0;

        if (!fs.existsSync(rejectedDir)) {
            return { deleted, freedBytes };
        }

        const entries = await fs.promises.readdir(rejectedDir, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(rejectedDir, entry.name);
            const stats = await fs.promises.stat(entryPath);

            if (stats.mtime < cutoffDate) {
                if (entry.isDirectory()) {
                    const files = await fs.promises.readdir(entryPath);
                    for (const file of files) {
                        const filePath = path.join(entryPath, file);
                        const fileStats = await fs.promises.stat(filePath);
                        freedBytes += fileStats.size;
                        await fs.promises.unlink(filePath);
                        deleted++;
                    }
                    await fs.promises.rmdir(entryPath);
                } else {
                    freedBytes += stats.size;
                    await fs.promises.unlink(entryPath);
                    deleted++;
                }
            }
        }

        return { deleted, freedBytes };
    }

    /**
     * Get absolute path to an asset
     */
    getAssetPath(relativePath: string): string {
        return path.join(this.baseDirectory, relativePath);
    }
}

export const assetManagerService = new AssetManagerService();
