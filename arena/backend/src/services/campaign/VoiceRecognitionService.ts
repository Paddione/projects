import { execFile } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);
const WHISPER_PATH = process.env.WHISPER_PATH || `${process.env.HOME}/.local/bin/whisper`;
const TEMP_DIR = join(tmpdir(), 'campaign-voice');

export interface VoiceRecognitionResult {
    transcription: string;
    expected: string;
    score: number;        // 0-100
    feedback: string;
    matchType: 'exact' | 'close' | 'wrong';
}

export class VoiceRecognitionService {
    constructor() {
        if (!existsSync(TEMP_DIR)) {
            mkdirSync(TEMP_DIR, { recursive: true });
        }
    }

    /**
     * Transcribe audio and compare to expected phrase.
     * @param audioBuffer Raw audio data (WAV format)
     * @param expectedPhrase The phrase the player should have said
     */
    async transcribeAndScore(audioBuffer: Buffer, expectedPhrase: string): Promise<VoiceRecognitionResult> {
        const id = uuidv4();
        const wavPath = join(TEMP_DIR, `${id}.wav`);

        try {
            // Write audio to temp file
            writeFileSync(wavPath, audioBuffer);

            // Run Whisper
            const { stdout } = await execFileAsync(WHISPER_PATH, [
                wavPath,
                '--model', 'base.en',
                '--output_format', 'txt',
                '--output_dir', TEMP_DIR,
                '--language', 'en',
            ], { timeout: 30000 });

            // Read transcription (Whisper outputs {filename}.txt)
            const txtPath = join(TEMP_DIR, `${id}.txt`);
            let transcription = '';
            if (existsSync(txtPath)) {
                transcription = readFileSync(txtPath, 'utf-8').trim();
                unlinkSync(txtPath);
            } else {
                // Fallback: parse stdout
                transcription = stdout.trim();
            }

            // Score the transcription
            const score = this.scoreMatch(transcription, expectedPhrase);
            const matchType = score >= 90 ? 'exact' : score >= 60 ? 'close' : 'wrong';

            const feedback = matchType === 'exact'
                ? 'Great pronunciation!'
                : matchType === 'close'
                    ? `Almost — you said "${transcription}". Try again!`
                    : `Not quite. The correct phrase is: "${expectedPhrase}"`;

            return { transcription, expected: expectedPhrase, score, feedback, matchType };
        } finally {
            // Cleanup temp files
            if (existsSync(wavPath)) unlinkSync(wavPath);
        }
    }

    /**
     * Score how well the transcription matches the expected phrase.
     * Returns 0-100.
     */
    private scoreMatch(transcription: string, expected: string): number {
        const a = this.normalize(transcription);
        const b = this.normalize(expected);

        if (a === b) return 100;

        // Word-level comparison
        const aWords = a.split(/\s+/);
        const bWords = b.split(/\s+/);

        let matches = 0;
        for (const word of aWords) {
            if (bWords.includes(word)) matches++;
        }

        const wordScore = bWords.length > 0 ? (matches / bWords.length) * 100 : 0;

        // Also do Levenshtein distance at character level for partial credit
        const editDistance = this.levenshtein(a, b);
        const maxLen = Math.max(a.length, b.length);
        const charScore = maxLen > 0 ? ((maxLen - editDistance) / maxLen) * 100 : 0;

        // Weighted average: 60% word match, 40% char similarity
        return Math.round(wordScore * 0.6 + charScore * 0.4);
    }

    private normalize(text: string): string {
        return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    private levenshtein(a: string, b: string): number {
        const matrix: number[][] = [];
        for (let i = 0; i <= a.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= b.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[a.length][b.length];
    }

    /**
     * Check if Whisper is available.
     */
    async isAvailable(): Promise<boolean> {
        try {
            await execFileAsync(WHISPER_PATH, ['--help'], { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }
}
