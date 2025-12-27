/**
 * Text-to-Speech Types
 * Type definitions for TTS operations with Coqui TTS / XTTSv2
 */

// ============================================================================
// Voice Model Types
// ============================================================================

export interface VoiceModel {
    id: string;
    name: string;
    language: string;
    sampleRate: number;
    description?: string;
    createdAt: string;
    isCustom: boolean;
    speakerEmbeddingPath?: string;  // Path to trained speaker embedding
    sourceAudioPath?: string;       // Original reference audio used for training
}

export interface VoiceModelCreate {
    name: string;
    language?: string;
    description?: string;
    referenceAudioPath: string;     // Audio sample for voice cloning
}

// ============================================================================
// TTS Options
// ============================================================================

export interface TTSOptions {
    voiceModelId?: string;          // Use specific trained voice model
    language?: string;              // Language code (e.g., 'en', 'de')
    speed?: number;                 // Speech speed multiplier (0.5 - 2.0)
    pitch?: number;                 // Pitch adjustment (-12 to 12 semitones)
    emotion?: string;               // Emotion hint (neutral, happy, sad, angry)
    outputFormat?: 'wav' | 'mp3' | 'ogg';
    sampleRate?: number;            // Output sample rate (e.g., 22050, 44100)
}

export interface VoiceCloneOptions {
    referenceAudioPath: string;     // Path to reference audio (6+ seconds recommended)
    language?: string;
    cleanup?: boolean;              // Clean up temp files after cloning
}

// ============================================================================
// TTS Results
// ============================================================================

export interface TTSResult {
    success: boolean;
    audioPath?: string;
    duration?: number;              // Audio duration in seconds
    processingTime?: number;        // Processing time in ms
    error?: string;
}

export interface VoiceTrainResult {
    success: boolean;
    model?: VoiceModel;
    processingTime?: number;
    error?: string;
}

// ============================================================================
// Supported TTS Languages
// ============================================================================

export const TTS_LANGUAGES: Record<string, string> = {
    en: 'English',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    pt: 'Portuguese',
    pl: 'Polish',
    tr: 'Turkish',
    ru: 'Russian',
    nl: 'Dutch',
    cs: 'Czech',
    ar: 'Arabic',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    hu: 'Hungarian',
};

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_TTS_OPTIONS: Required<Pick<TTSOptions, 'language' | 'speed' | 'outputFormat' | 'sampleRate'>> = {
    language: 'en',
    speed: 1.0,
    outputFormat: 'wav',
    sampleRate: 22050,
};
