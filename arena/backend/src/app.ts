import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { DatabaseService } from './services/DatabaseService.js';
import { LobbyService } from './services/LobbyService.js';
import { attachAuthUser } from './middleware/auth.js';
import { authFetch } from './config/authClient.js';

const app = express();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false
}));
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
}));
app.use(express.json());
app.use(attachAuthUser);

// ============================================================================
// HEALTH
// ============================================================================

app.get('/api/health', async (_req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const isHealthy = await db.healthCheck();
        res.json({
            status: isHealthy ? 'OK' : 'DEGRADED',
            service: 'arena-backend',
            timestamp: new Date().toISOString(),
            database: isHealthy ? 'connected' : 'disconnected',
        });
    } catch {
        res.status(503).json({
            status: 'ERROR',
            service: 'arena-backend',
            timestamp: new Date().toISOString(),
        });
    }
});

// ============================================================================
// AUTH
// ============================================================================

app.get('/api/auth/me', (req, res) => {
    const user = (req as any).user;
    if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
});

// ============================================================================
// LOBBIES
// ============================================================================

const lobbyService = new LobbyService();

app.post('/api/lobbies', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        // Fetch character/gender/powerUp from auth service profile
        let selectedCharacter: string | undefined;
        let selectedGender: 'male' | 'female' | undefined;
        let selectedPowerUp: string | null = null;
        const cookie = req.headers.cookie;
        if (cookie) {
            try {
                const profileRes = await authFetch('/api/profile', {
                    headers: { cookie },
                });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    if (profile) {
                        selectedCharacter = profile.selectedCharacter || profile.selected_character;
                        selectedGender = profile.selectedGender || profile.selected_gender;
                        selectedPowerUp = profile.equippedPowerUp || profile.equipped_power_up || null;
                    }
                }
            } catch {
                // Auth service unreachable, use defaults
            }
        }

        const lobby = await lobbyService.createLobby({
            hostId: user.userId,
            username: user.username,
            selectedCharacter,
            selectedGender,
            selectedPowerUp,
            settings: req.body.settings,
        });
        res.status(201).json(lobby);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

app.get('/api/lobbies/:code', async (req, res) => {
    try {
        const lobby = await lobbyService.getLobbyByCode(req.params.code);
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        res.json(lobby);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/lobbies', async (_req, res) => {
    try {
        const lobbies = await lobbyService.getActiveLobbies();
        res.json(lobbies);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.delete('/api/lobbies/:code', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const lobby = await lobbyService.getLobbyByCode(req.params.code);
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        if (!lobby.authUserId || lobby.authUserId !== user.userId) {
            return res.status(403).json({ error: 'Only the host can delete a lobby' });
        }
        await lobbyService.deleteLobbyByCode(req.params.code);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// LEADERBOARD
// ============================================================================

app.get('/api/leaderboard', async (_req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const result = await db.query(
            'SELECT * FROM arena_leaderboard LIMIT 100'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// PLAYER PROFILE
// ============================================================================

app.get('/api/players/:authUserId', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const result = await db.query(
            'SELECT * FROM players WHERE auth_user_id = $1',
            [parseInt(req.params.authUserId)]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/players', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const { selectedCharacter } = req.body;

        // Validate character ownership
        const baseChar = (selectedCharacter || 'student').replace('_f', '');
        if (baseChar !== 'student') {
            try {
                const profileRes = await authFetch('/api/profile', {
                    headers: { Cookie: req.headers.cookie || '' },
                });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    const ownedIds = (profile.inventory || [])
                        .filter((item: any) => item.itemType === 'character')
                        .map((item: any) => item.itemId.replace('character_', ''));
                    if (!ownedIds.includes(baseChar)) {
                        res.status(403).json({ error: 'Character not purchased' });
                        return;
                    }
                } else {
                    res.status(503).json({ error: 'Cannot verify character ownership' });
                    return;
                }
            } catch {
                res.status(503).json({ error: 'Cannot verify character ownership' });
                return;
            }
        }

        const db = DatabaseService.getInstance();
        const result = await db.query(
            `INSERT INTO players (auth_user_id, username, selected_character)
       VALUES ($1, $2, $3)
       ON CONFLICT (auth_user_id) DO UPDATE SET username = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [user.userId, user.username, selectedCharacter || 'student']
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// ============================================================================
// MATCH HISTORY
// ============================================================================

app.get('/api/matches', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await db.query(
            'SELECT * FROM matches ORDER BY started_at DESC LIMIT $1',
            [limit]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/matches/:id/results', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const matchId = parseInt(req.params.id);

        // Fetch match metadata (for winnerId)
        const matchRow = await db.query(
            `SELECT m.id, p.auth_user_id as winner_auth_id
             FROM matches m
             LEFT JOIN players p ON m.winner_id = p.id
             WHERE m.id = $1`,
            [matchId]
        );
        if (matchRow.rows.length === 0) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        // Fetch results with camelCase aliases
        const result = await db.query(
            `SELECT
                p.auth_user_id AS "playerId",
                mr.username,
                mr.character_name AS "character",
                mr.kills,
                mr.deaths,
                mr.damage_dealt AS "damageDealt",
                mr.items_collected AS "itemsCollected",
                mr.rounds_won AS "roundsWon",
                mr.placement,
                mr.experience_gained AS "experienceGained",
                mr.level_before AS "levelBefore",
                mr.level_after AS "levelAfter"
             FROM match_results mr
             JOIN players p ON mr.player_id = p.id
             WHERE mr.match_id = $1
             ORDER BY mr.placement ASC`,
            [matchId]
        );

        const winnerAuthId = matchRow.rows[0].winner_auth_id;
        res.json({
            winnerId: winnerAuthId ? String(winnerAuthId) : '',
            results: result.rows.map(row => ({
                ...row,
                playerId: String(row.playerId),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN
// ============================================================================

app.get('/api/campaign/progress', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const db = DatabaseService.getInstance();
        const result = await db.query(
            'SELECT * FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (result.rowCount === 0) {
            return res.json(null);  // No campaign started yet
        }
        const player = result.rows[0];

        // Also fetch active quests
        const quests = await db.query(
            `SELECT quest_id, status, progress, respect_earned, started_at, completed_at
             FROM campaign_quests WHERE player_id = $1 ORDER BY started_at DESC`,
            [player.id]
        );

        res.json({
            ...player,
            quests: quests.rows,
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/balance', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const result = await db.query(
            'SELECT dollar_balance, total_respect_earned FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (result.rowCount === 0) return res.json({ dollars: 0, respect: 0 });
        res.json({ dollars: result.rows[0].dollar_balance, respect: result.rows[0].total_respect_earned });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/phrases', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const result = await db.query(
            `SELECT cp.country_id, cp.syllable, cp.syllable_index, cp.collected_at
             FROM campaign_phrases cp
             JOIN campaign_players p ON cp.player_id = p.id
             WHERE p.auth_user_id = $1
             ORDER BY cp.country_id, cp.syllable_index`,
            [user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/transactions', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const result = await db.query(
            `SELECT dt.amount, dt.source, dt.metadata, dt.created_at
             FROM campaign_dollar_transactions dt
             JOIN campaign_players p ON dt.player_id = p.id
             WHERE p.auth_user_id = $1
             ORDER BY dt.created_at DESC LIMIT 50`,
            [user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/vocab', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const db = DatabaseService.getInstance();
        const result = await db.query(
            `SELECT v.* FROM campaign_vocab v
             JOIN campaign_players cp ON v.player_id = cp.id
             WHERE cp.auth_user_id = $1 ORDER BY v.collected_at DESC`,
            [user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — IDIOM CRAFTING
// ============================================================================

import { IdiomCraftingService } from './services/campaign/IdiomCraftingService.js';

const idiomCraftingService = new IdiomCraftingService();

app.get('/api/campaign/idioms/fragments', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.json([]);
        const fragments = await idiomCraftingService.getFragments(playerResult.rows[0].id);
        res.json(fragments);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/idioms/recipes', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        const allRecipes = idiomCraftingService.getAllRecipes();
        if (playerResult.rowCount === 0) {
            return res.json({ recipes: allRecipes, craftable: [] });
        }
        const craftable = await idiomCraftingService.getCraftableRecipes(playerResult.rows[0].id);
        const craftableIds = craftable.map(r => r.id);
        res.json({ recipes: allRecipes, craftable: craftableIds });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/idioms/craft', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { idiomId } = req.body;
        if (!idiomId) return res.status(400).json({ error: 'idiomId required' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });
        const result = await idiomCraftingService.craft(playerResult.rows[0].id, idiomId);
        if (!result.success) return res.status(400).json({ error: result.error });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/idioms/use', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { idiomId } = req.body;
        if (!idiomId) return res.status(400).json({ error: 'idiomId required' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });
        const result = await idiomCraftingService.useItem(playerResult.rows[0].id, idiomId);
        if (!result.success) return res.status(400).json({ error: 'Item not available or already consumed' });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/idioms/crafted', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.json([]);
        const items = await idiomCraftingService.getCraftedItems(playerResult.rows[0].id);
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — ENGLISH LEARNING SYSTEMS
// ============================================================================

import { VoiceRecognitionService } from './services/campaign/VoiceRecognitionService.js';
import { DictationService } from './services/campaign/DictationService.js';
import { WritingQuestService } from './services/campaign/WritingQuestService.js';

// Voice recognition
app.post('/api/campaign/voice/transcribe', async (_req, res) => {
    // Accept audio buffer + expectedPhrase, return VoiceRecognitionResult
    // For now, return a stub since we need multipart upload handling
    res.json({ available: false, message: 'Voice recognition requires microphone access and Whisper backend' });
});

app.get('/api/campaign/voice/available', async (_req, res) => {
    const voiceService = new VoiceRecognitionService();
    const available = await voiceService.isAvailable();
    res.json({ available });
});

// Dictation
app.get('/api/campaign/dictation/:country', async (req, res) => {
    const dictationService = new DictationService();
    const challenges = dictationService.getChallengesForCountry(req.params.country);
    res.json(challenges);
});

app.post('/api/campaign/dictation/score', async (req, res) => {
    const { challengeId, playerText } = req.body;
    if (!challengeId || !playerText) {
        return res.status(400).json({ error: 'challengeId and playerText required' });
    }
    const dictationService = new DictationService();
    const result = dictationService.scoreDictation(challengeId, playerText);
    if (!result) return res.status(404).json({ error: 'Challenge not found' });
    res.json(result);
});

// Writing quests
app.get('/api/campaign/writing/quests/:country', async (req, res) => {
    const writingService = new WritingQuestService();
    const quests = writingService.getQuestsForCountry(req.params.country);
    res.json(quests);
});

app.post('/api/campaign/writing/submit', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { questId, text } = req.body;
        if (!questId || !text) return res.status(400).json({ error: 'questId and text required' });

        const db = DatabaseService.getInstance();
        const playerResult = await db.query('SELECT id FROM campaign_players WHERE auth_user_id = $1', [user.userId]);
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign progress' });

        const writingService = new WritingQuestService();
        const submission = await writingService.submitWriting(playerResult.rows[0].id, questId, text);
        res.json(submission);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/writing/submissions', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const db = DatabaseService.getInstance();
        const playerResult = await db.query('SELECT id FROM campaign_players WHERE auth_user_id = $1', [user.userId]);
        if (playerResult.rowCount === 0) return res.json([]);

        const writingService = new WritingQuestService();
        const submissions = await writingService.getSubmissions(playerResult.rows[0].id);
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — NEWSPAPERS
// ============================================================================

import { NewspaperService } from './services/campaign/NewspaperService.js';

const newspaperService = new NewspaperService();

app.get('/api/campaign/newspaper/:country', async (req, res) => {
    try {
        const newspaper = newspaperService.getNewspaper(req.params.country);
        if (!newspaper) {
            return res.status(404).json({ error: 'No newspaper found for this country' });
        }

        // If authenticated, include read status
        const user = (req as any).user;
        let readArticleIds: string[] = [];
        if (user) {
            const db = DatabaseService.getInstance();
            const playerResult = await db.query(
                'SELECT id FROM campaign_players WHERE auth_user_id = $1',
                [user.userId]
            );
            if (playerResult.rowCount && playerResult.rowCount > 0) {
                readArticleIds = await newspaperService.getReadArticles(playerResult.rows[0].id);
            }
        }

        res.json({
            ...newspaper,
            articles: newspaper.articles.map(a => ({
                ...a,
                isRead: readArticleIds.includes(a.id),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/newspaper/read', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { countryId, articleId } = req.body;
        if (!countryId || !articleId) return res.status(400).json({ error: 'countryId and articleId required' });

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });

        await newspaperService.markAsRead(playerResult.rows[0].id, countryId, articleId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/newspaper/quiz', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { articleId, answers } = req.body;
        if (!articleId || !Array.isArray(answers)) {
            return res.status(400).json({ error: 'articleId and answers[] required' });
        }

        const result = newspaperService.scoreQuiz(articleId, answers);
        if (result.total === 0) return res.status(404).json({ error: 'Article not found' });

        // Mark article as read on quiz submission
        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount && playerResult.rowCount > 0) {
            // Find which country this article belongs to
            for (const country of newspaperService.getAvailableCountries()) {
                const newspaper = newspaperService.getNewspaper(country);
                if (newspaper?.articles.some(a => a.id === articleId)) {
                    await newspaperService.markAsRead(playerResult.rows[0].id, country, articleId);
                    break;
                }
            }
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — RADIO / PODCAST
// ============================================================================

import { RadioService } from './services/campaign/RadioService.js';

const radioService = new RadioService();

app.get('/api/campaign/radio/:country', async (req, res) => {
    try {
        const zones = radioService.getZonesForCountry(req.params.country);
        if (zones.length === 0) {
            return res.status(404).json({ error: 'No radio zones found for this country' });
        }

        // If authenticated, include which clips the player has already answered correctly
        const user = (req as any).user;
        let answeredClipIds: string[] = [];
        if (user) {
            const db = DatabaseService.getInstance();
            const playerResult = await db.query(
                'SELECT id FROM campaign_players WHERE auth_user_id = $1',
                [user.userId]
            );
            if (playerResult.rowCount && playerResult.rowCount > 0) {
                answeredClipIds = await radioService.getCorrectClipIds(playerResult.rows[0].id);
            }
        }

        res.json(zones.map(zone => ({
            ...zone,
            clips: zone.clips.map(clip => ({
                id: clip.id,
                title: clip.title,
                duration: clip.duration,
                script: clip.script,
                catchQuestion: clip.catchQuestion,
                respectReward: clip.respectReward,
                alreadyCaught: answeredClipIds.includes(clip.id),
            })),
        })));
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/radio/catch', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { clipId, answer } = req.body;
        if (!clipId || answer === undefined || answer === null) {
            return res.status(400).json({ error: 'clipId and answer required' });
        }

        const clip = radioService.getClip(clipId);
        if (!clip) return res.status(404).json({ error: 'Clip not found' });

        const result = radioService.scoreCatchQuestion(clipId, answer);

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount && playerResult.rowCount > 0) {
            await radioService.recordCatchAttempt(
                playerResult.rows[0].id,
                clipId,
                result.correct,
                result.respectReward
            );
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — LEADERBOARDS
// ============================================================================

import { LeaderboardService } from './services/campaign/LeaderboardService.js';
import type { LeaderboardType, LeaderboardScope, LeaderboardPeriod } from './services/campaign/LeaderboardService.js';

const leaderboardService = new LeaderboardService();

app.get('/api/campaign/leaderboard/types', (_req, res) => {
    res.json(leaderboardService.getLeaderboardTypes());
});

app.get('/api/campaign/leaderboard/:type', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const type = req.params.type as LeaderboardType;
        const scope = (req.query.scope as LeaderboardScope) || 'global';
        const period = (req.query.period as LeaderboardPeriod) || 'alltime';
        const classId = req.query.classId ? parseInt(req.query.classId as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 25;

        const entries = await leaderboardService.getLeaderboard(
            type, scope, period, user.userId, classId, limit,
        );
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/friends/add', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { friendAuthUserId } = req.body;
        if (!friendAuthUserId) return res.status(400).json({ error: 'friendAuthUserId required' });

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId],
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });

        const friendResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [friendAuthUserId],
        );
        if (friendResult.rowCount === 0) return res.status(404).json({ error: 'Friend player not found' });

        await leaderboardService.addFriend(playerResult.rows[0].id, friendResult.rows[0].id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.delete('/api/campaign/friends/:friendAuthUserId', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const friendAuthUserId = parseInt(req.params.friendAuthUserId);

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId],
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });

        const friendResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [friendAuthUserId],
        );
        if (friendResult.rowCount === 0) return res.status(404).json({ error: 'Friend player not found' });

        await leaderboardService.removeFriend(playerResult.rows[0].id, friendResult.rows[0].id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/friends', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId],
        );
        if (playerResult.rowCount === 0) return res.json([]);

        const friends = await leaderboardService.getFriends(playerResult.rows[0].id);
        res.json(friends);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — PENPAL SYSTEM
// ============================================================================

import { PenpalService } from './services/campaign/PenpalService.js';

const penpalService = new PenpalService();

app.get('/api/campaign/penpal/unread', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query('SELECT id FROM campaign_players WHERE auth_user_id = $1', [user.userId]);
        if (playerResult.rowCount === 0) return res.json({ count: 0 });
        const count = await penpalService.getUnreadCount(playerResult.rows[0].id);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/penpal/:country', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query('SELECT id FROM campaign_players WHERE auth_user_id = $1', [user.userId]);
        if (playerResult.rowCount === 0) return res.json([]);
        const letters = await penpalService.getLetters(playerResult.rows[0].id, req.params.country);
        res.json(letters);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/penpal/:country/generate', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query('SELECT id FROM campaign_players WHERE auth_user_id = $1', [user.userId]);
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });
        const letter = await penpalService.generateIncomingLetter(playerResult.rows[0].id, req.params.country);
        res.json(letter);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/penpal/:country/reply', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'text required' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query('SELECT id FROM campaign_players WHERE auth_user_id = $1', [user.userId]);
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });
        const result = await penpalService.submitReply(playerResult.rows[0].id, req.params.country, text);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/penpal/read/:letterId', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const db = DatabaseService.getInstance();
        const playerResult = await db.query('SELECT id FROM campaign_players WHERE auth_user_id = $1', [user.userId]);
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });
        await penpalService.markRead(playerResult.rows[0].id, parseInt(req.params.letterId));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — TEACHER LAYER
// ============================================================================

import { TeacherService } from './services/campaign/TeacherService.js';

const teacherService = new TeacherService();

app.post('/api/campaign/teacher/classes', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'name required' });
        const result = await teacherService.createClass(user.userId, name);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/teacher/classes', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classes = await teacherService.getClasses(user.userId);
        res.json(classes);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/teacher/classes/:id/overview', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.id);
        const isTeacher = await teacherService.isTeacherOfClass(classId, user.userId);
        if (!isTeacher) return res.status(403).json({ error: 'Not the teacher of this class' });
        const overview = await teacherService.getClassOverview(classId);
        res.json(overview);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/teacher/classes/:id/students', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.id);
        const isTeacher = await teacherService.isTeacherOfClass(classId, user.userId);
        if (!isTeacher) return res.status(403).json({ error: 'Not the teacher of this class' });
        const { studentAuthUserId } = req.body;
        if (!studentAuthUserId) return res.status(400).json({ error: 'studentAuthUserId required' });
        await teacherService.addStudent(classId, studentAuthUserId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.delete('/api/campaign/teacher/classes/:id/students/:studentId', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.id);
        const isTeacher = await teacherService.isTeacherOfClass(classId, user.userId);
        if (!isTeacher) return res.status(403).json({ error: 'Not the teacher of this class' });
        await teacherService.removeStudent(classId, parseInt(req.params.studentId));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/teacher/students/:id', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const detail = await teacherService.getStudentDetail(parseInt(req.params.id));
        if (!detail) return res.status(404).json({ error: 'Student not found' });
        res.json(detail);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/teacher/classes/:id/assignments', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.id);
        const isTeacher = await teacherService.isTeacherOfClass(classId, user.userId);
        if (!isTeacher) return res.status(403).json({ error: 'Not the teacher of this class' });
        const { questId, title, description, dueDate } = req.body;
        if (!questId || !title) return res.status(400).json({ error: 'questId and title required' });
        const result = await teacherService.createAssignment(classId, user.userId, { questId, title, description, dueDate });
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/teacher/classes/:id/assignments', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.id);
        const assignments = await teacherService.getAssignments(classId);
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/teacher/classes/:id/alerts', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.id);
        const isTeacher = await teacherService.isTeacherOfClass(classId, user.userId);
        if (!isTeacher) return res.status(403).json({ error: 'Not the teacher of this class' });
        const alerts = await teacherService.checkForAlerts(classId);
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/teacher/classes/:id/report', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.id);
        const isTeacher = await teacherService.isTeacherOfClass(classId, user.userId);
        if (!isTeacher) return res.status(403).json({ error: 'Not the teacher of this class' });
        const report = await teacherService.generateSessionReport(classId);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/teacher/grading-queue/:classId', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const classId = parseInt(req.params.classId);
        const isTeacher = await teacherService.isTeacherOfClass(classId, user.userId);
        if (!isTeacher) return res.status(403).json({ error: 'Not the teacher of this class' });
        const queue = await teacherService.getPenpalGradingQueue(classId);
        res.json(queue);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/teacher/grade-penpal/:letterId', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { grade, feedback } = req.body;
        if (!grade || !feedback) return res.status(400).json({ error: 'grade and feedback required' });
        await teacherService.upgradePenpalGrade(parseInt(req.params.letterId), grade, feedback);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/teacher/ask', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: 'question required' });
        const response = await teacherService.askClosedPaw(user.userId, question);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — EDITOR
// ============================================================================

import { CampaignEditorService } from './services/campaign/CampaignEditorService.js';

const campaignEditorService = new CampaignEditorService();

app.post('/api/campaign/editor/quests', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const data = req.body;
        if (!data.title || !data.questType || !data.objectives) {
            return res.status(400).json({ error: 'title, questType, and objectives required' });
        }
        data.createdByAuthUserId = user.userId;
        const result = await campaignEditorService.createQuest(data);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/editor/quests', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const filters: { audience?: string; classId?: number; createdBy?: number } = {};
        if (req.query.audience) filters.audience = req.query.audience as string;
        if (req.query.classId) filters.classId = parseInt(req.query.classId as string);
        if (req.query.createdBy) filters.createdBy = parseInt(req.query.createdBy as string);
        const quests = await campaignEditorService.getQuests(filters);
        res.json(quests);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.put('/api/campaign/editor/quests/:id', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const questId = req.params.id;
        const existing = await campaignEditorService.getQuestById(questId);
        if (!existing) return res.status(404).json({ error: 'Quest not found' });
        if (existing.createdByAuthUserId !== user.userId) {
            return res.status(403).json({ error: 'Can only edit your own quests' });
        }
        await campaignEditorService.updateQuest(questId, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.delete('/api/campaign/editor/quests/:id', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const questId = req.params.id;
        const existing = await campaignEditorService.getQuestById(questId);
        if (!existing) return res.status(404).json({ error: 'Quest not found' });
        if (existing.createdByAuthUserId !== user.userId) {
            return res.status(403).json({ error: 'Can only delete your own quests' });
        }
        await campaignEditorService.deactivateQuest(questId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/editor/generate', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { prompt, cefrLevel } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt required' });
        const questData = await campaignEditorService.generateFromPrompt(prompt, cefrLevel || 'A2');
        questData.createdByAuthUserId = user.userId;
        res.json(questData);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// CAMPAIGN — GOOGLE DOCS INTEGRATION
// ============================================================================

import { GoogleDocsService } from './services/campaign/GoogleDocsService.js';

const googleDocsService = new GoogleDocsService();

app.post('/api/campaign/docs/export-writing', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { questTitle, text, grade } = req.body;
        if (!questTitle || !text) return res.status(400).json({ error: 'questTitle and text required' });

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });

        const result = await googleDocsService.exportWritingQuest(playerResult.rows[0].id, questTitle, text, grade);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/docs/export-vocab', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { vocabCards } = req.body;
        if (!Array.isArray(vocabCards) || vocabCards.length === 0) {
            return res.status(400).json({ error: 'vocabCards array required' });
        }

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });

        const result = await googleDocsService.exportVocabCollection(playerResult.rows[0].id, vocabCards);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/docs/export-penpal', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { countryId, letters } = req.body;
        if (!countryId || !Array.isArray(letters)) {
            return res.status(400).json({ error: 'countryId and letters array required' });
        }

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.status(404).json({ error: 'No campaign player found' });

        const result = await googleDocsService.exportPenpalCorrespondence(playerResult.rows[0].id, countryId, letters);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/docs/exports', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const db = DatabaseService.getInstance();
        const playerResult = await db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [user.userId]
        );
        if (playerResult.rowCount === 0) return res.json([]);

        const exports = await googleDocsService.getExports(playerResult.rows[0].id);
        res.json(exports);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/docs/connection', (_req, res) => {
    res.json(googleDocsService.getConnectionInfo());
});

// ============================================================================
// CAMPAIGN — JITSI RECORDING
// ============================================================================

import { JitsiRecordingService } from './services/campaign/JitsiRecordingService.js';

const jitsiRecordingService = new JitsiRecordingService();

app.post('/api/campaign/recording/start', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { sessionId, jitsiRoom, participants, countryId } = req.body;
        if (!sessionId || !jitsiRoom) {
            return res.status(400).json({ error: 'sessionId and jitsiRoom required' });
        }

        const recording = await jitsiRecordingService.startRecording(
            sessionId,
            jitsiRoom,
            participants || [],
            countryId || ''
        );
        res.status(201).json(recording);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/campaign/recording/stop', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { recordingId } = req.body;
        if (!recordingId) return res.status(400).json({ error: 'recordingId required' });

        const recording = await jitsiRecordingService.stopRecording(recordingId);
        res.json(recording);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/recording/:sessionId', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const recordings = await jitsiRecordingService.getRecordings(req.params.sessionId);
        res.json(recordings);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/campaign/recordings', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const recordings = await jitsiRecordingService.getPlayerRecordings(user.userId);
        res.json(recordings);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default app;
