export type DictationDifficulty = 'slow' | 'normal' | 'fast';

export interface DictationChallenge {
    id: string;
    text: string;           // The correct text
    difficulty: DictationDifficulty;
    npcId: string;          // Which NPC gives this dictation
    country: string;
    audioUrl?: string;      // TTS audio URL (generated on demand)
}

export interface DictationResult {
    challengeId: string;
    playerText: string;
    correctText: string;
    score: number;          // 0-100
    errors: DictationError[];
    feedback: string;
}

export interface DictationError {
    position: number;
    expected: string;
    got: string;
    type: 'missing' | 'extra' | 'wrong';
}

export class DictationService {
    private challenges: Map<string, DictationChallenge> = new Map();

    constructor() {
        this.loadChallenges();
    }

    private loadChallenges(): void {
        // Hardcoded Phase 1 challenges — will be loaded from JSON in later phases
        const challenges: DictationChallenge[] = [
            // Werner (newspaper) — Germany
            { id: 'dict_werner_1', text: 'The weather in Lüneburg is cold today.', difficulty: 'slow', npcId: 'werner', country: 'germany' },
            { id: 'dict_werner_2', text: 'A new market has opened near the church.', difficulty: 'slow', npcId: 'werner', country: 'germany' },
            { id: 'dict_werner_3', text: 'The mayor spoke about the festival last night.', difficulty: 'normal', npcId: 'werner', country: 'germany' },
            // Finn (bulletin) — Germany
            { id: 'dict_finn_1', text: 'All volunteers are welcome to join.', difficulty: 'slow', npcId: 'finn', country: 'germany' },
            { id: 'dict_finn_2', text: 'The fire department is looking for new members.', difficulty: 'normal', npcId: 'finn', country: 'germany' },
            // Singapore
            { id: 'dict_sg_1', text: 'The hawker centre closes at ten o\'clock.', difficulty: 'slow', npcId: 'hawker_boss', country: 'singapore' },
            { id: 'dict_sg_2', text: 'Please do not feed the monkeys in the park.', difficulty: 'normal', npcId: 'hawker_boss', country: 'singapore' },
            // Ireland
            { id: 'dict_ie_1', text: 'The pub quiz starts at half past seven.', difficulty: 'slow', npcId: 'seamus', country: 'ireland' },
            { id: 'dict_ie_2', text: 'Have you ever seen the Cliffs of Moher on a sunny day?', difficulty: 'normal', npcId: 'seamus', country: 'ireland' },
            // Australia
            { id: 'dict_au_1', text: 'We are going to the beach this arvo.', difficulty: 'normal', npcId: 'bazza_guide', country: 'australia' },
            { id: 'dict_au_2', text: 'The barbecue starts at noon but come whenever you want.', difficulty: 'fast', npcId: 'bazza_guide', country: 'australia' },
            // USA
            { id: 'dict_us_1', text: 'Turn right at the gas station and go two blocks.', difficulty: 'slow', npcId: 'tyler_attendant', country: 'usa' },
            { id: 'dict_us_2', text: 'I reckon we should head downtown for the fireworks tonight.', difficulty: 'fast', npcId: 'tyler_attendant', country: 'usa' },
        ];

        for (const c of challenges) {
            this.challenges.set(c.id, c);
        }
        console.log(`[DictationService] Loaded ${this.challenges.size} dictation challenges`);
    }

    getChallenge(id: string): DictationChallenge | undefined {
        return this.challenges.get(id);
    }

    getChallengesForNPC(npcId: string): DictationChallenge[] {
        return Array.from(this.challenges.values()).filter(c => c.npcId === npcId);
    }

    getChallengesForCountry(country: string): DictationChallenge[] {
        return Array.from(this.challenges.values()).filter(c => c.country === country);
    }

    /**
     * Score a player's dictation attempt.
     */
    scoreDictation(challengeId: string, playerText: string): DictationResult | null {
        const challenge = this.challenges.get(challengeId);
        if (!challenge) return null;

        const correct = challenge.text;
        const errors = this.findErrors(correct, playerText);

        // Score: word-level accuracy
        const correctWords = this.tokenize(correct);
        const playerWords = this.tokenize(playerText);

        let matches = 0;
        const maxLen = Math.max(correctWords.length, playerWords.length);
        for (let i = 0; i < Math.min(correctWords.length, playerWords.length); i++) {
            if (correctWords[i] === playerWords[i]) matches++;
        }

        const score = maxLen > 0 ? Math.round((matches / maxLen) * 100) : 0;

        let feedback: string;
        if (score >= 90) feedback = 'Excellent! Nearly perfect dictation.';
        else if (score >= 70) feedback = 'Good work! A few words were different.';
        else if (score >= 50) feedback = 'Keep practicing! Compare your text with the correct version.';
        else feedback = 'Try listening again more carefully. The correct text is shown below.';

        return { challengeId, playerText, correctText: correct, score, errors, feedback };
    }

    private tokenize(text: string): string[] {
        return text.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);
    }

    private findErrors(correct: string, player: string): DictationError[] {
        const cWords = this.tokenize(correct);
        const pWords = this.tokenize(player);
        const errors: DictationError[] = [];

        const maxLen = Math.max(cWords.length, pWords.length);
        for (let i = 0; i < maxLen; i++) {
            const cw = cWords[i];
            const pw = pWords[i];
            if (!cw && pw) {
                errors.push({ position: i, expected: '', got: pw, type: 'extra' });
            } else if (cw && !pw) {
                errors.push({ position: i, expected: cw, got: '', type: 'missing' });
            } else if (cw !== pw) {
                errors.push({ position: i, expected: cw || '', got: pw || '', type: 'wrong' });
            }
        }

        return errors;
    }
}
