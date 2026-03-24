import { create } from 'zustand';

// ============================================================================
// Campaign Frontend Types (mirrors backend campaign.ts client-facing types)
// ============================================================================

export interface DialogueClientLine {
    speaker: string;
    text: string;
    choices?: Array<{ id: string; text: string }>;
    triggersQuiz?: boolean;
}

export interface QuestObjectiveClient {
    id: string;
    text: string;
    requiredCount: number;
    currentCount: number;
    completed: boolean;
}

export interface QuestClientState {
    questId: string;
    title: string;
    description: string;
    status: 'available' | 'active' | 'complete' | 'failed' | 'hint_passed';
    objectives: QuestObjectiveClient[];
}

export interface QuizQuestion {
    id: string;
    text: string;
    answers: Array<{ id: string; text: string }>;
    difficulty: number;
    hint?: string;
    answerType: string;
}

export interface VocabCardData {
    wordEn: string;
    wordDe: string;
    definitionEn: string;
    exampleEn: string;
    foundInCountry: string;
    foundAtNpc?: string;
}

// ============================================================================
// Store State Slices
// ============================================================================

interface DialogueState {
    active: boolean;
    npcId: string | null;
    lines: DialogueClientLine[];
    currentIndex: number;
}

interface QuizState {
    active: boolean;
    questions: QuizQuestion[];
    currentIndex: number;
    rewardQuestId: string | null;
}

interface MapTransitionState {
    active: boolean;
    phase: 'fade-out' | 'loading' | 'fade-in' | 'idle';
    targetMapId: string | null;
}

interface SaveIndicatorState {
    visible: boolean;
    timestamp: number | null;
}

// ============================================================================
// Full Store Interface
// ============================================================================

interface CampaignStore {
    // Session
    sessionId: string | null;
    currentMapId: string | null;
    playerPosition: { x: number; y: number } | null;

    // Quests
    activeQuests: QuestClientState[];
    completedQuestIds: string[];

    // NPC interaction
    nearbyNpcId: string | null;
    interactPromptVisible: boolean;
    dialogue: DialogueState;

    // Quiz
    quiz: QuizState;

    // Map transition
    mapTransition: MapTransitionState;

    // Vocab
    vocabCards: VocabCardData[];
    newCardNotification: boolean;

    // Save
    saveIndicator: SaveIndicatorState;

    // UI toggles
    mapOverlayOpen: boolean;

    // Actions — Session
    setSession: (sessionId: string, mapId: string) => void;
    setPlayerPosition: (position: { x: number; y: number }) => void;
    setNearbyNpc: (npcId: string | null) => void;

    // Actions — Dialogue
    openDialogue: (npcId: string, lines: DialogueClientLine[]) => void;
    advanceDialogue: () => void;
    closeDialogue: () => void;
    chooseDialogueOption: (choiceId: string) => void;

    // Actions — Quests
    updateQuest: (quest: QuestClientState) => void;
    completeQuest: (questId: string) => void;
    addQuest: (quest: QuestClientState) => void;

    // Actions — Quiz
    startQuiz: (questions: QuizQuestion[], rewardQuestId: string | null) => void;
    advanceQuiz: () => void;
    closeQuiz: () => void;

    // Actions — Map transition
    beginMapTransition: (targetMapId: string) => void;
    completeMapTransition: (mapId: string) => void;

    // Actions — Vocab
    addVocabCard: (card: VocabCardData) => void;
    dismissNewCardNotification: () => void;

    // Actions — Save
    showSaveIndicator: () => void;

    // Actions — UI
    setMapOverlay: (open: boolean) => void;

    // Actions — Reset
    resetCampaign: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
    // Session
    sessionId: null as string | null,
    currentMapId: null as string | null,
    playerPosition: null as { x: number; y: number } | null,

    // Quests
    activeQuests: [] as QuestClientState[],
    completedQuestIds: [] as string[],

    // NPC interaction
    nearbyNpcId: null as string | null,
    interactPromptVisible: false,
    dialogue: {
        active: false,
        npcId: null,
        lines: [],
        currentIndex: 0,
    } as DialogueState,

    // Quiz
    quiz: {
        active: false,
        questions: [],
        currentIndex: 0,
        rewardQuestId: null,
    } as QuizState,

    // Map transition
    mapTransition: {
        active: false,
        phase: 'idle' as const,
        targetMapId: null,
    } as MapTransitionState,

    // Vocab
    vocabCards: [] as VocabCardData[],
    newCardNotification: false,

    // Save
    saveIndicator: {
        visible: false,
        timestamp: null,
    } as SaveIndicatorState,

    // UI toggles
    mapOverlayOpen: false,
};

// ============================================================================
// Store
// ============================================================================

export const useCampaignStore = create<CampaignStore>((set) => ({
    ...initialState,

    // Session
    setSession: (sessionId, mapId) => set({ sessionId, currentMapId: mapId }),
    setPlayerPosition: (position) => set({ playerPosition: position }),
    setNearbyNpc: (npcId) => set({
        nearbyNpcId: npcId,
        interactPromptVisible: npcId !== null,
    }),

    // Dialogue
    openDialogue: (npcId, lines) => set({
        dialogue: { active: true, npcId, lines, currentIndex: 0 },
    }),
    advanceDialogue: () => set((state) => {
        const next = state.dialogue.currentIndex + 1;
        if (next >= state.dialogue.lines.length) {
            return { dialogue: { active: false, npcId: null, lines: [], currentIndex: 0 } };
        }
        return { dialogue: { ...state.dialogue, currentIndex: next } };
    }),
    closeDialogue: () => set({
        dialogue: { active: false, npcId: null, lines: [], currentIndex: 0 },
    }),
    chooseDialogueOption: (_choiceId) => set((state) => {
        // Choice is sent to server via socket; locally we just advance past the choice node
        const next = state.dialogue.currentIndex + 1;
        if (next >= state.dialogue.lines.length) {
            return { dialogue: { active: false, npcId: null, lines: [], currentIndex: 0 } };
        }
        return { dialogue: { ...state.dialogue, currentIndex: next } };
    }),

    // Quests
    updateQuest: (quest) => set((state) => {
        const existing = state.activeQuests.findIndex((q) => q.questId === quest.questId);
        if (existing >= 0) {
            const updated = [...state.activeQuests];
            updated[existing] = quest;
            return { activeQuests: updated };
        }
        return { activeQuests: [...state.activeQuests, quest] };
    }),
    completeQuest: (questId) => set((state) => ({
        activeQuests: state.activeQuests.filter((q) => q.questId !== questId),
        completedQuestIds: [...state.completedQuestIds, questId],
    })),
    addQuest: (quest) => set((state) => ({
        activeQuests: [...state.activeQuests, quest],
    })),

    // Quiz
    startQuiz: (questions, rewardQuestId) => set({
        quiz: { active: true, questions, currentIndex: 0, rewardQuestId },
    }),
    advanceQuiz: () => set((state) => ({
        quiz: { ...state.quiz, currentIndex: state.quiz.currentIndex + 1 },
    })),
    closeQuiz: () => set({
        quiz: { active: false, questions: [], currentIndex: 0, rewardQuestId: null },
    }),

    // Map transition
    beginMapTransition: (targetMapId) => set({
        mapTransition: { active: true, phase: 'fade-out', targetMapId },
    }),
    completeMapTransition: (mapId) => set({
        currentMapId: mapId,
        mapTransition: { active: false, phase: 'idle', targetMapId: null },
    }),

    // Vocab
    addVocabCard: (card) => set((state) => ({
        vocabCards: [...state.vocabCards, card],
        newCardNotification: true,
    })),
    dismissNewCardNotification: () => set({ newCardNotification: false }),

    // Save
    showSaveIndicator: () => {
        const now = Date.now();
        set({ saveIndicator: { visible: true, timestamp: now } });
        setTimeout(() => {
            set((state) => {
                // Only hide if this is still the same save event
                if (state.saveIndicator.timestamp === now) {
                    return { saveIndicator: { visible: false, timestamp: null } };
                }
                return {};
            });
        }, 2000);
    },

    // UI
    setMapOverlay: (open) => set({ mapOverlayOpen: open }),

    // Reset
    resetCampaign: () => set(initialState),
}));
