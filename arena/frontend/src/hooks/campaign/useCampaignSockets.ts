import { useEffect } from 'react';
import { useCampaignStore } from '../../stores/campaignStore';
import { getSocket } from '../../services/apiService';
import { SoundService } from '../../services/SoundService';
import type { MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type {
    DialogueClientLine,
    QuestClientState,
    QuizQuestion,
    VocabCardData,
} from '../../stores/campaignStore';

interface UseCampaignSocketsOptions {
    sessionId: string | null;
    navigate: NavigateFunction;
    sessionStateRef: MutableRefObject<any>;
}

export function useCampaignSockets({
    sessionId,
    navigate: _navigate,
    sessionStateRef,
}: UseCampaignSocketsOptions) {
    const {
        setSession,
        setPlayerPosition,
        openDialogue,
        updateQuest,
        completeQuest,
        beginMapTransition,
        showSaveIndicator,
        addVocabCard,
        startQuiz,
        advanceQuiz,
        closeQuiz,
    } = useCampaignStore();

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        socket.on('campaign-state', (state: any) => {
            sessionStateRef.current = state;
            if (state.player) {
                setPlayerPosition({ x: state.player.x, y: state.player.y });
            }
        });

        socket.on('campaign-npc-dialogue', (data: { npcId: string; lines: DialogueClientLine[] }) => {
            openDialogue(data.npcId, data.lines);
        });

        socket.on('campaign-quest-update', (data: { quest: QuestClientState }) => {
            updateQuest(data.quest);
        });

        socket.on('campaign-quest-complete', (data: { questId: string; respectGained: number; vocabCards: any[] }) => {
            completeQuest(data.questId);
        });

        socket.on('campaign-map-change', (data: { targetMapId: string; spawnX: number; spawnY: number }) => {
            beginMapTransition(data.targetMapId);
        });

        socket.on('campaign-checkpoint-saved', () => {
            showSaveIndicator();
        });

        socket.on('campaign-vocab-collected', (data: { card: VocabCardData }) => {
            addVocabCard(data.card);
        });

        socket.on('campaign-quiz-start', (data: { questionSetId: string; questions: QuizQuestion[]; rewardQuestId: string | null }) => {
            startQuiz(data.questions, data.rewardQuestId);
        });

        socket.on('campaign-quiz-result', (data: { correct: boolean; score: number; completed: boolean }) => {
            if (data.completed) {
                closeQuiz();
            } else {
                advanceQuiz();
            }
        });

        socket.on('campaign-enemy-killed', (_data: { enemyId: string; respectGained: number; vocabDrop?: VocabCardData }) => {
            SoundService.playSFX('player_death');
        });

        socket.on('campaign-session-started', (data: { sessionId: string; state: any }) => {
            setSession(data.sessionId, data.state.mapId);
            sessionStateRef.current = data.state;
            if (data.state.player) {
                setPlayerPosition({ x: data.state.player.x, y: data.state.player.y });
            }
        });

        socket.on('campaign-error', (data: { message: string }) => {
            console.error('[Campaign] Server error:', data.message);
        });

        return () => {
            socket.off('campaign-state');
            socket.off('campaign-npc-dialogue');
            socket.off('campaign-quest-update');
            socket.off('campaign-quest-complete');
            socket.off('campaign-map-change');
            socket.off('campaign-checkpoint-saved');
            socket.off('campaign-vocab-collected');
            socket.off('campaign-quiz-start');
            socket.off('campaign-quiz-result');
            socket.off('campaign-enemy-killed');
            socket.off('campaign-session-started');
            socket.off('campaign-error');
        };
    }, [sessionId]);
}
