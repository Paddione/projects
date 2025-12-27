/**
 * Asset Manager Types
 * Type definitions for multi-asset generation and selection workflow
 */

// ============================================================================
// Asset Types
// ============================================================================

export interface AssetMetadata {
    id: string;
    sessionId: string;
    prompt: string;
    negativePrompt?: string;
    model?: string;
    seed?: number;
    width: number;
    height: number;
    steps?: number;
    cfgScale?: number;
    sampler?: string;
    createdAt: string;
    selected: boolean;
    rejected: boolean;
    filename: string;
    relativePath: string;
    fileSize?: number;
}

export interface AssetSession {
    id: string;
    prompt: string;
    negativePrompt?: string;
    settings: GenerationSettings;
    variants: AssetMetadata[];
    createdAt: string;
    status: 'pending' | 'selected' | 'rejected' | 'partial';
}

export interface GenerationSettings {
    model?: string;
    width: number;
    height: number;
    steps?: number;
    cfgScale?: number;
    sampler?: string;
    variantCount: number;
    seedStart?: number;
}

// ============================================================================
// Generation Options
// ============================================================================

export interface GenerateVariantsOptions {
    prompt: string;
    negativePrompt?: string;
    count?: number;         // Number of variants to generate (default: 4)
    width?: number;
    height?: number;
    steps?: number;
    cfgScale?: number;
    sampler?: string;
    seedStart?: number;     // Starting seed for reproducibility
}

export interface SelectionOptions {
    sessionId: string;
    selectedIndices: number[];     // 0-based indices of selected variants
    targetDirectory?: string;      // Where to move selected assets
    organizationScheme?: 'date' | 'prompt' | 'flat';  // How to organize selected files
}

// ============================================================================
// Result Types
// ============================================================================

export interface GenerationResult {
    success: boolean;
    session?: AssetSession;
    error?: string;
    processingTime?: number;
}

export interface SelectionResult {
    success: boolean;
    selectedPaths?: string[];      // Paths to selected assets
    rejectedPaths?: string[];      // Paths to rejected assets
    error?: string;
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
    width: 1024,
    height: 1024,
    steps: 30,
    cfgScale: 7.0,
    sampler: 'Euler a',
    variantCount: 4,
};

// ============================================================================
// Directory Structure Constants
// ============================================================================

export const ASSET_DIRECTORIES = {
    PENDING: 'pending',
    SELECTED: 'selected',
    REJECTED: 'rejected',
};
