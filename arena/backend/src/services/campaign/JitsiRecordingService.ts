import { DatabaseService } from '../DatabaseService.js';

const JITSI_URL = process.env.JITSI_URL || 'https://meet.korczewski.de';

export interface RecordingSession {
    id?: number;
    sessionId: string;
    jitsiRoom: string;
    recordingStartedAt: string;
    recordingEndedAt?: string;
    durationSeconds?: number;
    videovaultClipId?: string;
    googleDriveUrl?: string;
    participants: string[];
    countryId: string;
    status: 'recording' | 'processing' | 'complete' | 'failed';
}

export class JitsiRecordingService {
    private db: DatabaseService;

    constructor() {
        this.db = DatabaseService.getInstance();
    }

    /**
     * Start a recording for a Jitsi session.
     * In production, this would call Jitsi's startRecording API.
     */
    async startRecording(sessionId: string, jitsiRoom: string, participants: string[], countryId: string): Promise<RecordingSession> {
        console.log(`[JitsiRecordingService] Starting recording for room ${jitsiRoom}`);

        const result = await this.db.query(
            `INSERT INTO campaign_jitsi_recordings (session_id, jitsi_room, participants, country_id, status)
             VALUES ($1, $2, $3, $4, 'recording') RETURNING id, recording_started_at`,
            [sessionId, jitsiRoom, JSON.stringify(participants), countryId]
        );

        return {
            id: result.rows[0].id,
            sessionId,
            jitsiRoom,
            recordingStartedAt: result.rows[0].recording_started_at,
            participants,
            countryId,
            status: 'recording',
        };
    }

    /**
     * Stop a recording and process it.
     */
    async stopRecording(recordingId: number): Promise<RecordingSession> {
        const result = await this.db.query(
            `UPDATE campaign_jitsi_recordings
             SET status = 'processing',
                 recording_ended_at = NOW(),
                 duration_seconds = EXTRACT(EPOCH FROM (NOW() - recording_started_at))::int
             WHERE id = $1 RETURNING *`,
            [recordingId]
        );

        if (result.rowCount === 0) throw new Error('Recording not found');

        const row = result.rows[0];

        // In production: upload to VideoVault, optionally to Google Drive
        // For now, mark as complete with stub VideoVault ID
        const videovaultClipId = `vv_recording_${recordingId}`;

        await this.db.query(
            `UPDATE campaign_jitsi_recordings SET status = 'complete', videovault_clip_id = $1 WHERE id = $2`,
            [videovaultClipId, recordingId]
        );

        console.log(`[JitsiRecordingService] Recording ${recordingId} complete (${row.duration_seconds}s)`);

        return {
            id: recordingId,
            sessionId: row.session_id,
            jitsiRoom: row.jitsi_room,
            recordingStartedAt: row.recording_started_at,
            recordingEndedAt: row.recording_ended_at,
            durationSeconds: row.duration_seconds,
            videovaultClipId,
            participants: JSON.parse(row.participants),
            countryId: row.country_id,
            status: 'complete',
        };
    }

    /**
     * Get recordings for a session.
     */
    async getRecordings(sessionId: string): Promise<RecordingSession[]> {
        const result = await this.db.query(
            `SELECT * FROM campaign_jitsi_recordings WHERE session_id = $1 ORDER BY recording_started_at DESC`,
            [sessionId]
        );
        return result.rows.map((r: any) => ({
            id: r.id,
            sessionId: r.session_id,
            jitsiRoom: r.jitsi_room,
            recordingStartedAt: r.recording_started_at,
            recordingEndedAt: r.recording_ended_at,
            durationSeconds: r.duration_seconds,
            videovaultClipId: r.videovault_clip_id,
            googleDriveUrl: r.google_drive_url,
            participants: JSON.parse(r.participants || '[]'),
            countryId: r.country_id,
            status: r.status,
        }));
    }

    /**
     * Get all recordings for a player (across all sessions).
     */
    async getPlayerRecordings(authUserId: number): Promise<RecordingSession[]> {
        const result = await this.db.query(
            `SELECT jr.* FROM campaign_jitsi_recordings jr
             JOIN campaign_sessions cs ON jr.session_id = cs.id::text
             WHERE cs.host_player_id IN (SELECT id FROM campaign_players WHERE auth_user_id = $1)
             ORDER BY jr.recording_started_at DESC LIMIT 20`,
            [authUserId]
        );
        return result.rows.map((r: any) => ({
            id: r.id,
            sessionId: r.session_id,
            jitsiRoom: r.jitsi_room,
            recordingStartedAt: r.recording_started_at,
            recordingEndedAt: r.recording_ended_at,
            durationSeconds: r.duration_seconds,
            videovaultClipId: r.videovault_clip_id,
            participants: JSON.parse(r.participants || '[]'),
            countryId: r.country_id,
            status: r.status,
        }));
    }

    /**
     * Generate a Jitsi room URL for a campaign context.
     */
    getRoomUrl(roomName: string): string {
        return `${JITSI_URL}/${roomName}`;
    }
}
