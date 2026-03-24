import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
    CampaignNPCDef,
    DialogueTree,
    DialogueNode,
    DialogueClientLine,
    QuestState,
} from '../../types/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAX_DIALOGUE_ITERATIONS = 20;

export class CampaignNPCService {
    private npcs: Map<string, CampaignNPCDef> = new Map();
    private dialogues: Map<string, DialogueTree> = new Map();

    constructor() {
        this.loadData();
    }

    private loadData(): void {
        try {
            const dataPath = join(__dirname, '../../data/campaign/npcs.json');
            const raw = readFileSync(dataPath, 'utf-8');
            const data = JSON.parse(raw);

            // Load NPC definitions
            if (data.npcs) {
                for (const [id, npc] of Object.entries(data.npcs)) {
                    this.npcs.set(id, npc as CampaignNPCDef);
                }
            }

            // Load dialogue trees
            if (data.dialogues) {
                for (const [id, dialogue] of Object.entries(data.dialogues)) {
                    this.dialogues.set(id, dialogue as DialogueTree);
                }
            }

            console.log(`[CampaignNPCService] Loaded ${this.npcs.size} NPCs, ${this.dialogues.size} dialogue trees`);
        } catch (error) {
            console.error('[CampaignNPCService] Failed to load NPC data:', error);
        }
    }

    getNPC(npcId: string): CampaignNPCDef | undefined {
        return this.npcs.get(npcId);
    }

    getAllNPCs(): CampaignNPCDef[] {
        return Array.from(this.npcs.values());
    }

    getDialogueTree(dialogueId: string): DialogueTree | undefined {
        return this.dialogues.get(dialogueId);
    }

    /**
     * Process a dialogue interaction. Given quest state, walk the dialogue tree
     * and return the lines to show the player.
     *
     * Walks through nodes:
     * - 'text': add to lines, follow next
     * - 'choice': add to lines with choices array, STOP (wait for player choice)
     * - 'quiz': add to lines with triggersQuiz=true, STOP (client will handle quiz)
     * - 'reward': add to lines, follow next (rewards are processed server-side separately)
     * - 'condition': check quest state, branch to onTrue or onFalse
     */
    getDialogueLines(npcId: string, questStates: Record<string, QuestState>): DialogueClientLine[] {
        const npc = this.npcs.get(npcId);
        if (!npc) return [];

        const tree = this.dialogues.get(npc.dialogueId);
        if (!tree) return [];

        return this.walkDialogue(tree, tree.startNode, questStates);
    }

    /**
     * Given a choice, continue the dialogue from the chosen branch.
     */
    continueDialogue(
        dialogueId: string,
        choiceId: string,
        questStates: Record<string, QuestState>
    ): DialogueClientLine[] {
        const tree = this.dialogues.get(dialogueId);
        if (!tree) return [];

        // Find the choice node that contains this choiceId and get the target node
        for (const node of Object.values(tree.nodes)) {
            if (node.type === 'choice') {
                const choice = node.choices.find((c) => c.id === choiceId);
                if (choice) {
                    return this.walkDialogue(tree, choice.next, questStates);
                }
            }
        }

        return [];
    }

    /**
     * Get the dialogue node by ID (for processing rewards, quiz triggers, etc.)
     */
    getNode(dialogueId: string, nodeId: string): DialogueNode | undefined {
        const tree = this.dialogues.get(dialogueId);
        if (!tree) return undefined;
        return tree.nodes[nodeId];
    }

    /**
     * Find what node comes after a quiz pass/fail.
     */
    getPostQuizNode(
        dialogueId: string,
        quizNodeId: string,
        passed: boolean
    ): DialogueNode | undefined {
        const tree = this.dialogues.get(dialogueId);
        if (!tree) return undefined;

        const quizNode = tree.nodes[quizNodeId];
        if (!quizNode || quizNode.type !== 'quiz') return undefined;

        const nextNodeId = passed ? quizNode.onPass : quizNode.onFail;
        return tree.nodes[nextNodeId];
    }

    /**
     * Get the post-quiz dialogue lines (continues from onPass or onFail).
     */
    getPostQuizLines(
        dialogueId: string,
        quizNodeId: string,
        passed: boolean,
        questStates: Record<string, QuestState>
    ): DialogueClientLine[] {
        const tree = this.dialogues.get(dialogueId);
        if (!tree) return [];

        const quizNode = tree.nodes[quizNodeId];
        if (!quizNode || quizNode.type !== 'quiz') return [];

        const nextNodeId = passed ? quizNode.onPass : quizNode.onFail;
        return this.walkDialogue(tree, nextNodeId, questStates);
    }

    /**
     * Walk the dialogue tree from a given node, collecting lines.
     */
    private walkDialogue(
        tree: DialogueTree,
        startNodeId: string,
        questStates: Record<string, QuestState>
    ): DialogueClientLine[] {
        const lines: DialogueClientLine[] = [];
        let currentNodeId: string | null = startNodeId;
        let iterations = 0;

        while (currentNodeId && iterations < MAX_DIALOGUE_ITERATIONS) {
            iterations++;
            const node = tree.nodes[currentNodeId] as DialogueNode | undefined;
            if (!node) break;

            switch (node.type) {
                case 'text': {
                    lines.push({
                        speaker: node.speaker,
                        text: node.text,
                    });
                    currentNodeId = node.next;
                    break;
                }

                case 'choice': {
                    lines.push({
                        speaker: node.speaker,
                        text: node.text,
                        choices: node.choices.map((c) => ({
                            id: c.id,
                            text: c.text,
                        })),
                    });
                    // STOP — wait for player choice
                    currentNodeId = null;
                    break;
                }

                case 'quiz': {
                    lines.push({
                        speaker: node.speaker,
                        text: node.text,
                        triggersQuiz: true,
                    });
                    // STOP — client will handle quiz
                    currentNodeId = null;
                    break;
                }

                case 'reward': {
                    lines.push({
                        speaker: node.speaker,
                        text: node.text,
                    });
                    currentNodeId = node.next;
                    break;
                }

                case 'condition': {
                    const met = this.evaluateCondition(node, questStates);
                    currentNodeId = met ? node.onTrue : node.onFalse;
                    break;
                }

                default:
                    currentNodeId = null;
                    break;
            }
        }

        if (iterations >= MAX_DIALOGUE_ITERATIONS) {
            console.warn(`[CampaignNPCService] Dialogue iteration limit reached for tree: ${tree.id}`);
        }

        return lines;
    }

    /**
     * Evaluate a condition node against quest states.
     */
    private evaluateCondition(
        node: { requiresQuestComplete?: string; requiresQuestActive?: string },
        questStates: Record<string, QuestState>
    ): boolean {
        if (node.requiresQuestComplete) {
            const state = questStates[node.requiresQuestComplete];
            return state?.status === 'complete';
        }

        if (node.requiresQuestActive) {
            const state = questStates[node.requiresQuestActive];
            return state?.status === 'active';
        }

        // No condition specified — default true
        return true;
    }

    /**
     * Find the last reward node encountered before a stop point in a dialogue walk.
     * Used to process rewards when dialogue reaches a reward node.
     */
    findRewardNodes(
        dialogueId: string,
        startNodeId: string,
        questStates: Record<string, QuestState>
    ): DialogueNode[] {
        const tree = this.dialogues.get(dialogueId);
        if (!tree) return [];

        const rewardNodes: DialogueNode[] = [];
        let currentNodeId: string | null = startNodeId;
        let iterations = 0;

        while (currentNodeId && iterations < MAX_DIALOGUE_ITERATIONS) {
            iterations++;
            const node = tree.nodes[currentNodeId] as DialogueNode | undefined;
            if (!node) break;

            if (node.type === 'reward') {
                rewardNodes.push(node);
                currentNodeId = node.next;
            } else if (node.type === 'text') {
                currentNodeId = node.next;
            } else if (node.type === 'condition') {
                const met = this.evaluateCondition(node, questStates);
                currentNodeId = met ? node.onTrue : node.onFalse;
            } else {
                // choice or quiz — stop
                break;
            }
        }

        return rewardNodes;
    }
}
