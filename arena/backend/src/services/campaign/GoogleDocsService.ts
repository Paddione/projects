import { DatabaseService } from '../DatabaseService.js';

const MATON_CONNECTION_ID = 'eb2955bc-47cc-45f1-b6b2-94828a938776';

export interface GoogleDocExport {
    docId: string;
    docUrl: string;
    title: string;
    folder: string;
    exportedAt: string;
}

export class GoogleDocsService {
    private db: DatabaseService;

    constructor() {
        this.db = DatabaseService.getInstance();
    }

    /**
     * Export a writing quest submission to Google Docs.
     * Folder: Campaign/Journal/
     */
    async exportWritingQuest(playerId: number, questTitle: string, text: string, _grade: any): Promise<GoogleDocExport> {
        const title = `${questTitle} — ${new Date().toLocaleDateString('en-GB')}`;
        console.log(`[GoogleDocsService] Would export writing quest to Campaign/Journal/${title}`);

        // Log export intent to DB (for retry if Google API is unavailable)
        await this.db.query(
            `INSERT INTO campaign_doc_exports (player_id, doc_type, title, folder, content_preview, status)
             VALUES ($1, 'journal', $2, 'Campaign/Journal/', $3, 'pending')`,
            [playerId, title, text.substring(0, 200)]
        );

        // Stub — return placeholder
        return {
            docId: `stub_${Date.now()}`,
            docUrl: `https://docs.google.com/document/d/stub_${Date.now()}`,
            title,
            folder: 'Campaign/Journal/',
            exportedAt: new Date().toISOString(),
        };
    }

    /**
     * Export penpal correspondence to Google Docs.
     * Folder: Campaign/Penpals/{country}.gdoc
     */
    async exportPenpalCorrespondence(playerId: number, countryId: string, letters: Array<{ direction: string; body: string; createdAt: string }>): Promise<GoogleDocExport> {
        const title = `Penpal — ${countryId.charAt(0).toUpperCase() + countryId.slice(1)}`;
        console.log(`[GoogleDocsService] Would export penpal archive to Campaign/Penpals/${title}`);

        const content = letters.map(l =>
            `[${l.direction === 'incoming' ? 'From penpal' : 'My reply'}] ${l.createdAt}\n${l.body}\n`
        ).join('\n---\n\n');

        await this.db.query(
            `INSERT INTO campaign_doc_exports (player_id, doc_type, title, folder, content_preview, status)
             VALUES ($1, 'penpal', $2, 'Campaign/Penpals/', $3, 'pending')`,
            [playerId, title, content.substring(0, 200)]
        );

        return {
            docId: `stub_${Date.now()}`,
            docUrl: `https://docs.google.com/document/d/stub_${Date.now()}`,
            title,
            folder: 'Campaign/Penpals/',
            exportedAt: new Date().toISOString(),
        };
    }

    /**
     * Export vocab collection to Google Docs.
     * Folder: Campaign/Vocab Lists/
     */
    async exportVocabCollection(playerId: number, vocabCards: Array<{ word_en: string; word_de: string; definition_en: string; example_en: string }>): Promise<GoogleDocExport> {
        const title = `Vocabulary Collection — ${new Date().toLocaleDateString('en-GB')}`;
        console.log(`[GoogleDocsService] Would export ${vocabCards.length} vocab cards`);

        const content = vocabCards.map(v =>
            `**${v.word_en}** (${v.word_de})\n  ${v.definition_en}\n  _"${v.example_en}"_\n`
        ).join('\n');

        await this.db.query(
            `INSERT INTO campaign_doc_exports (player_id, doc_type, title, folder, content_preview, status)
             VALUES ($1, 'vocab', $2, 'Campaign/Vocab Lists/', $3, 'pending')`,
            [playerId, title, content.substring(0, 200)]
        );

        return {
            docId: `stub_${Date.now()}`,
            docUrl: `https://docs.google.com/document/d/stub_${Date.now()}`,
            title,
            folder: 'Campaign/Vocab Lists/',
            exportedAt: new Date().toISOString(),
        };
    }

    /**
     * Export session report to Google Docs.
     * Folder: Campaign/Reports/
     */
    async exportSessionReport(classId: number, report: any): Promise<GoogleDocExport> {
        const title = `Session Report — ${new Date().toLocaleDateString('en-GB')}`;
        console.log(`[GoogleDocsService] Would export session report for class ${classId}`);

        await this.db.query(
            `INSERT INTO campaign_doc_exports (player_id, doc_type, title, folder, content_preview, status)
             VALUES ($1, 'report', $2, 'Campaign/Reports/', $3, 'pending')`,
            [0, title, JSON.stringify(report).substring(0, 200)]
        );

        return {
            docId: `stub_${Date.now()}`,
            docUrl: `https://docs.google.com/document/d/stub_${Date.now()}`,
            title,
            folder: 'Campaign/Reports/',
            exportedAt: new Date().toISOString(),
        };
    }

    /**
     * Get export history for a player.
     */
    async getExports(playerId: number): Promise<GoogleDocExport[]> {
        const result = await this.db.query(
            `SELECT title, folder, status, created_at FROM campaign_doc_exports
             WHERE player_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [playerId]
        );
        return result.rows.map((r: any) => ({
            docId: 'pending',
            docUrl: '#',
            title: r.title,
            folder: r.folder,
            exportedAt: r.created_at,
        }));
    }

    /**
     * Get Maton connection info (for future real integration).
     */
    getConnectionInfo(): { connectionId: string; status: string } {
        return {
            connectionId: MATON_CONNECTION_ID,
            status: 'stub — awaiting Maton integration',
        };
    }
}
