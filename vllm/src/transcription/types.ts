/**
 * Transcription Service Types
 * Type definitions for Whisper transcription operations
 */

// ============================================================================
// Whisper Model Types
// ============================================================================

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';

export interface WhisperModelInfo {
    name: WhisperModel;
    size: string;
    parameters: string;
    relativeSpeed: number;
    description: string;
}

export const WHISPER_MODELS: Record<WhisperModel, WhisperModelInfo> = {
    tiny: {
        name: 'tiny',
        size: '39 MB',
        parameters: '39M',
        relativeSpeed: 32,
        description: 'Fastest, basic accuracy. Good for quick tests.',
    },
    base: {
        name: 'base',
        size: '74 MB',
        parameters: '74M',
        relativeSpeed: 16,
        description: 'Fast with reasonable accuracy.',
    },
    small: {
        name: 'small',
        size: '244 MB',
        parameters: '244M',
        relativeSpeed: 6,
        description: 'Good balance of speed and accuracy.',
    },
    medium: {
        name: 'medium',
        size: '769 MB',
        parameters: '769M',
        relativeSpeed: 2,
        description: 'High accuracy, slower processing.',
    },
    large: {
        name: 'large',
        size: '1.5 GB',
        parameters: '1550M',
        relativeSpeed: 1,
        description: 'Best accuracy, slowest processing.',
    },
    'large-v2': {
        name: 'large-v2',
        size: '1.5 GB',
        parameters: '1550M',
        relativeSpeed: 1,
        description: 'Improved large model with better accuracy.',
    },
    'large-v3': {
        name: 'large-v3',
        size: '1.5 GB',
        parameters: '1550M',
        relativeSpeed: 1,
        description: 'Latest large model with best accuracy.',
    },
};

// ============================================================================
// Transcription Options
// ============================================================================

export interface TranscriptionOptions {
    model?: WhisperModel;
    language?: string;           // ISO language code (e.g., 'en', 'de', 'es')
    task?: 'transcribe' | 'translate';  // translate always outputs English
    wordTimestamps?: boolean;
    outputFormat?: 'text' | 'srt' | 'vtt' | 'json';
    verbose?: boolean;
    temperature?: number;
    bestOf?: number;
    beamSize?: number;
    patience?: number;
    initialPrompt?: string;      // Context/vocabulary hints
}

// ============================================================================
// Transcription Results
// ============================================================================

export interface TranscriptionSegment {
    id: number;
    start: number;              // Start time in seconds
    end: number;                // End time in seconds
    text: string;
    words?: TranscriptionWord[];
    noSpeechProb?: number;
}

export interface TranscriptionWord {
    word: string;
    start: number;
    end: number;
    probability: number;
}

export interface TranscriptionResult {
    success: boolean;
    text?: string;              // Full transcription text
    segments?: TranscriptionSegment[];
    language?: string;          // Detected language
    languageProbability?: number;
    duration?: number;          // Audio duration
    processingTime?: number;    // Time to process in ms
    srtPath?: string;           // Path to generated SRT file
    vttPath?: string;           // Path to generated VTT file
    error?: string;
}

// ============================================================================
// Subtitle Types
// ============================================================================

export interface SubtitleEntry {
    index: number;
    startTime: string;          // SRT format: 00:00:00,000
    endTime: string;            // SRT format: 00:00:00,000
    text: string;
}

export interface SubtitleStyle {
    fontName?: string;
    fontSize?: number;
    fontColor?: string;         // Hex color or ASS color code
    backgroundColor?: string;
    outlineColor?: string;
    outlineWidth?: number;
    position?: 'bottom' | 'top' | 'center';
    marginV?: number;           // Vertical margin
    marginH?: number;           // Horizontal margin
}

// ============================================================================
// Supported Languages
// ============================================================================

export const SUPPORTED_LANGUAGES: Record<string, string> = {
    en: 'English',
    zh: 'Chinese',
    de: 'German',
    es: 'Spanish',
    ru: 'Russian',
    ko: 'Korean',
    fr: 'French',
    ja: 'Japanese',
    pt: 'Portuguese',
    tr: 'Turkish',
    pl: 'Polish',
    ca: 'Catalan',
    nl: 'Dutch',
    ar: 'Arabic',
    sv: 'Swedish',
    it: 'Italian',
    id: 'Indonesian',
    hi: 'Hindi',
    fi: 'Finnish',
    vi: 'Vietnamese',
    he: 'Hebrew',
    uk: 'Ukrainian',
    el: 'Greek',
    ms: 'Malay',
    cs: 'Czech',
    ro: 'Romanian',
    da: 'Danish',
    hu: 'Hungarian',
    ta: 'Tamil',
    no: 'Norwegian',
    th: 'Thai',
    ur: 'Urdu',
    hr: 'Croatian',
    bg: 'Bulgarian',
    lt: 'Lithuanian',
    la: 'Latin',
    mi: 'Maori',
    ml: 'Malayalam',
    cy: 'Welsh',
    sk: 'Slovak',
    te: 'Telugu',
    fa: 'Persian',
    lv: 'Latvian',
    bn: 'Bengali',
    sr: 'Serbian',
    az: 'Azerbaijani',
    sl: 'Slovenian',
    kn: 'Kannada',
    et: 'Estonian',
    mk: 'Macedonian',
    br: 'Breton',
    eu: 'Basque',
    is: 'Icelandic',
    hy: 'Armenian',
    ne: 'Nepali',
    mn: 'Mongolian',
    bs: 'Bosnian',
    kk: 'Kazakh',
    sq: 'Albanian',
    sw: 'Swahili',
    gl: 'Galician',
    mr: 'Marathi',
    pa: 'Punjabi',
    si: 'Sinhala',
    km: 'Khmer',
    sn: 'Shona',
    yo: 'Yoruba',
    so: 'Somali',
    af: 'Afrikaans',
    oc: 'Occitan',
    ka: 'Georgian',
    be: 'Belarusian',
    tg: 'Tajik',
    sd: 'Sindhi',
    gu: 'Gujarati',
    am: 'Amharic',
    yi: 'Yiddish',
    lo: 'Lao',
    uz: 'Uzbek',
    fo: 'Faroese',
    ht: 'Haitian Creole',
    ps: 'Pashto',
    tk: 'Turkmen',
    nn: 'Nynorsk',
    mt: 'Maltese',
    sa: 'Sanskrit',
    lb: 'Luxembourgish',
    my: 'Myanmar',
    bo: 'Tibetan',
    tl: 'Tagalog',
    mg: 'Malagasy',
    as: 'Assamese',
    tt: 'Tatar',
    haw: 'Hawaiian',
    ln: 'Lingala',
    ha: 'Hausa',
    ba: 'Bashkir',
    jw: 'Javanese',
    su: 'Sundanese',
};
