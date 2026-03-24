import { DatabaseService } from '../DatabaseService.js';
import type {
    ClassInfo,
    StudentDetail,
    TeacherAlert,
    SessionReport,
    PenpalGrade,
} from '../../types/campaign.js';

export interface CreateAssignmentData {
    questId: string;
    title: string;
    description?: string;
    dueDate?: string;
}

export interface Assignment {
    id: number;
    classId: number;
    questId: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    createdByAuthUserId: number;
    createdAt: string;
    completionCount?: number;
}

export interface Completion {
    assignmentId: number;
    studentAuthUserId: number;
    completedAt: string;
}

export interface StudentInfo {
    authUserId: number;
    joinedAt: string;
}

export interface PenpalSubmission {
    letterId: number;
    studentAuthUserId: number;
    countryId: string;
    body: string;
    gradeJson: any;
    createdAt: string;
}

export interface ClassOverviewEntry {
    authUserId: number;
    cefrLevel: string;
    lastActive: string;
    quizAccuracy: number;
    questsCompleted: number;
    totalRespect: number;
}

export class TeacherService {
    private db: DatabaseService;

    constructor() {
        this.db = DatabaseService.getInstance();
    }

    // ========================================================================
    // Class Management
    // ========================================================================

    async createClass(teacherAuthUserId: number, name: string): Promise<{ id: number }> {
        const result = await this.db.query(
            `INSERT INTO campaign_classes (teacher_auth_user_id, name) VALUES ($1, $2) RETURNING id`,
            [teacherAuthUserId, name]
        );
        return { id: result.rows[0].id };
    }

    async addStudent(classId: number, studentAuthUserId: number): Promise<void> {
        await this.db.query(
            `INSERT INTO campaign_class_members (class_id, student_auth_user_id)
             VALUES ($1, $2) ON CONFLICT (class_id, student_auth_user_id) DO NOTHING`,
            [classId, studentAuthUserId]
        );
    }

    async removeStudent(classId: number, studentAuthUserId: number): Promise<void> {
        await this.db.query(
            `DELETE FROM campaign_class_members WHERE class_id = $1 AND student_auth_user_id = $2`,
            [classId, studentAuthUserId]
        );
    }

    async getClasses(teacherAuthUserId: number): Promise<ClassInfo[]> {
        const result = await this.db.query(
            `SELECT c.id, c.name, c.created_at,
                    COUNT(cm.id)::int AS student_count
             FROM campaign_classes c
             LEFT JOIN campaign_class_members cm ON cm.class_id = c.id
             WHERE c.teacher_auth_user_id = $1
             GROUP BY c.id
             ORDER BY c.created_at DESC`,
            [teacherAuthUserId]
        );

        return result.rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            studentCount: r.student_count,
            createdAt: r.created_at,
        }));
    }

    async getClassMembers(classId: number): Promise<StudentInfo[]> {
        const result = await this.db.query(
            `SELECT student_auth_user_id, joined_at
             FROM campaign_class_members WHERE class_id = $1
             ORDER BY joined_at ASC`,
            [classId]
        );

        return result.rows.map((r: any) => ({
            authUserId: r.student_auth_user_id,
            joinedAt: r.joined_at,
        }));
    }

    /**
     * Verify the requesting user is the teacher of a given class.
     */
    async isTeacherOfClass(classId: number, teacherAuthUserId: number): Promise<boolean> {
        const result = await this.db.query(
            `SELECT 1 FROM campaign_classes WHERE id = $1 AND teacher_auth_user_id = $2`,
            [classId, teacherAuthUserId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // ========================================================================
    // Student Analytics
    // ========================================================================

    async getStudentDetail(studentAuthUserId: number): Promise<StudentDetail | null> {
        const result = await this.db.query(
            `SELECT cp.auth_user_id, cp.english_level, cp.total_respect_earned,
                    cp.total_quizzes_completed, cp.total_quiz_accuracy, cp.last_checkpoint_at,
                    (SELECT COUNT(*) FROM campaign_quests cq WHERE cq.player_id = cp.id AND cq.status = 'complete')::int AS quests_completed,
                    (SELECT COUNT(*) FROM campaign_vocab cv WHERE cv.player_id = cp.id)::int AS vocab_collected
             FROM campaign_players cp
             WHERE cp.auth_user_id = $1`,
            [studentAuthUserId]
        );

        if ((result.rowCount ?? 0) === 0) return null;

        const r = result.rows[0];
        const accuracy = parseFloat(r.total_quiz_accuracy) || 0;

        // Determine weakest topic from quiz data (simplified — real analysis in Phase 6)
        let weakestTopic = 'N/A';
        if (accuracy < 50) weakestTopic = 'General vocabulary';
        else if (accuracy < 70) weakestTopic = 'Grammar structures';
        else if (accuracy < 85) weakestTopic = 'Reading comprehension';

        return {
            authUserId: r.auth_user_id,
            username: `user_${r.auth_user_id}`, // Would be joined from auth service in production
            cefrLevel: r.english_level,
            questsCompleted: r.quests_completed,
            vocabCollected: r.vocab_collected,
            quizAccuracy: accuracy,
            lastActive: r.last_checkpoint_at,
            weakestTopic,
        };
    }

    async getClassOverview(classId: number): Promise<ClassOverviewEntry[]> {
        const result = await this.db.query(
            `SELECT cm.student_auth_user_id,
                    COALESCE(cp.english_level, 'A1') AS cefr_level,
                    COALESCE(cp.last_checkpoint_at, cm.joined_at) AS last_active,
                    COALESCE(cp.total_quiz_accuracy, 0)::numeric AS quiz_accuracy,
                    COALESCE((SELECT COUNT(*) FROM campaign_quests cq WHERE cq.player_id = cp.id AND cq.status = 'complete'), 0)::int AS quests_completed,
                    COALESCE(cp.total_respect_earned, 0) AS total_respect
             FROM campaign_class_members cm
             LEFT JOIN campaign_players cp ON cp.auth_user_id = cm.student_auth_user_id
             WHERE cm.class_id = $1
             ORDER BY cm.joined_at ASC`,
            [classId]
        );

        return result.rows.map((r: any) => ({
            authUserId: r.student_auth_user_id,
            cefrLevel: r.cefr_level,
            lastActive: r.last_active,
            quizAccuracy: parseFloat(r.quiz_accuracy) || 0,
            questsCompleted: r.quests_completed,
            totalRespect: r.total_respect,
        }));
    }

    // ========================================================================
    // Assignments
    // ========================================================================

    async createAssignment(classId: number, teacherAuthUserId: number, data: CreateAssignmentData): Promise<{ id: number }> {
        const result = await this.db.query(
            `INSERT INTO campaign_class_assignments (class_id, quest_id, title, description, due_date, created_by_auth_user_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [classId, data.questId, data.title, data.description || null, data.dueDate || null, teacherAuthUserId]
        );
        return { id: result.rows[0].id };
    }

    async getAssignments(classId: number): Promise<Assignment[]> {
        const result = await this.db.query(
            `SELECT a.id, a.class_id, a.quest_id, a.title, a.description, a.due_date,
                    a.created_by_auth_user_id, a.created_at,
                    (SELECT COUNT(*) FROM campaign_assignment_completions ac WHERE ac.assignment_id = a.id)::int AS completion_count
             FROM campaign_class_assignments a
             WHERE a.class_id = $1
             ORDER BY a.created_at DESC`,
            [classId]
        );

        return result.rows.map((r: any) => ({
            id: r.id,
            classId: r.class_id,
            questId: r.quest_id,
            title: r.title,
            description: r.description,
            dueDate: r.due_date,
            createdByAuthUserId: r.created_by_auth_user_id,
            createdAt: r.created_at,
            completionCount: r.completion_count,
        }));
    }

    async getAssignmentCompletions(assignmentId: number): Promise<Completion[]> {
        const result = await this.db.query(
            `SELECT assignment_id, student_auth_user_id, completed_at
             FROM campaign_assignment_completions
             WHERE assignment_id = $1
             ORDER BY completed_at ASC`,
            [assignmentId]
        );

        return result.rows.map((r: any) => ({
            assignmentId: r.assignment_id,
            studentAuthUserId: r.student_auth_user_id,
            completedAt: r.completed_at,
        }));
    }

    async completeAssignment(assignmentId: number, studentAuthUserId: number): Promise<void> {
        await this.db.query(
            `INSERT INTO campaign_assignment_completions (assignment_id, student_auth_user_id)
             VALUES ($1, $2) ON CONFLICT (assignment_id, student_auth_user_id) DO NOTHING`,
            [assignmentId, studentAuthUserId]
        );
    }

    // ========================================================================
    // Penpal Grading Queue
    // ========================================================================

    async getPenpalGradingQueue(classId: number): Promise<PenpalSubmission[]> {
        // Get all penpal replies from class members that haven't been teacher-graded yet
        const result = await this.db.query(
            `SELECT pl.id AS letter_id, cm.student_auth_user_id, pl.country_id,
                    pl.body, pl.grade_json, pl.created_at
             FROM campaign_penpal_letters pl
             JOIN campaign_players cp ON cp.id = pl.player_id
             JOIN campaign_class_members cm ON cm.student_auth_user_id = cp.auth_user_id AND cm.class_id = $1
             WHERE pl.direction = 'reply'
             ORDER BY pl.created_at DESC
             LIMIT 50`,
            [classId]
        );

        return result.rows.map((r: any) => ({
            letterId: r.letter_id,
            studentAuthUserId: r.student_auth_user_id,
            countryId: r.country_id,
            body: r.body,
            gradeJson: r.grade_json ? (typeof r.grade_json === 'string' ? JSON.parse(r.grade_json) : r.grade_json) : null,
            createdAt: r.created_at,
        }));
    }

    async upgradePenpalGrade(letterId: number, grade: PenpalGrade, feedback: string): Promise<void> {
        // Teacher or ClosedPaw upgrades the auto-grade with real feedback
        const gradeWithFeedback = { ...grade, feedback };
        await this.db.query(
            `UPDATE campaign_penpal_letters SET grade_json = $1 WHERE id = $2`,
            [JSON.stringify(gradeWithFeedback), letterId]
        );
    }

    // ========================================================================
    // Session Reports
    // ========================================================================

    async generateSessionReport(classId: number): Promise<SessionReport> {
        const overview = await this.getClassOverview(classId);

        const studentHighlights = overview.map(student => {
            let highlight = 'Getting started';
            if (student.questsCompleted >= 10) highlight = 'Making excellent progress!';
            else if (student.questsCompleted >= 5) highlight = 'Good momentum — keep it up!';
            else if (student.questsCompleted >= 1) highlight = 'Completed first quests';
            else if (student.quizAccuracy > 0) highlight = 'Attempting quizzes';

            return {
                username: `user_${student.authUserId}`,
                questsDone: student.questsCompleted,
                vocabEarned: 0, // Would be joined from campaign_vocab count
                accuracy: student.quizAccuracy,
                highlight,
            };
        });

        const report: SessionReport = {
            classId,
            generatedAt: new Date().toISOString(),
            studentHighlights,
        };

        // Persist report
        await this.db.query(
            `INSERT INTO campaign_session_reports (class_id, report_json) VALUES ($1, $2)`,
            [classId, JSON.stringify(report)]
        );

        return report;
    }

    // ========================================================================
    // Proactive Alerts
    // ========================================================================

    async checkForAlerts(classId: number): Promise<TeacherAlert[]> {
        const alerts: TeacherAlert[] = [];
        const now = new Date().toISOString();

        // Get all class members with their campaign data
        const result = await this.db.query(
            `SELECT cm.student_auth_user_id,
                    cp.english_level,
                    cp.total_quiz_accuracy,
                    cp.last_checkpoint_at,
                    cp.total_quizzes_completed
             FROM campaign_class_members cm
             LEFT JOIN campaign_players cp ON cp.auth_user_id = cm.student_auth_user_id
             WHERE cm.class_id = $1`,
            [classId]
        );

        for (const r of result.rows) {
            const userId = r.student_auth_user_id;
            const username = `user_${userId}`;

            // Alert: No progress in 7 days
            if (r.last_checkpoint_at) {
                const lastActive = new Date(r.last_checkpoint_at);
                const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceActive > 7) {
                    alerts.push({
                        type: 'no_progress',
                        studentAuthUserId: userId,
                        studentUsername: username,
                        message: `${username} hasn't been active for ${Math.floor(daysSinceActive)} days`,
                        severity: daysSinceActive > 14 ? 'critical' : 'warning',
                        createdAt: now,
                    });
                }
            }

            // Alert: Accuracy dropped significantly
            const accuracy = parseFloat(r.total_quiz_accuracy) || 0;
            if (r.total_quizzes_completed > 5 && accuracy < 50) {
                alerts.push({
                    type: 'accuracy_drop',
                    studentAuthUserId: userId,
                    studentUsername: username,
                    message: `${username}'s quiz accuracy is only ${accuracy.toFixed(1)}% — may need extra help`,
                    severity: accuracy < 30 ? 'critical' : 'warning',
                    createdAt: now,
                });
            }

            // Alert: No campaign player record (never started)
            if (!r.english_level) {
                alerts.push({
                    type: 'no_progress',
                    studentAuthUserId: userId,
                    studentUsername: username,
                    message: `${username} hasn't started the campaign yet`,
                    severity: 'info',
                    createdAt: now,
                });
            }
        }

        // Check for students stuck on quizzes (failed same quiz 3+ times)
        const stuckResult = await this.db.query(
            `SELECT cm.student_auth_user_id, cq.quest_id, COUNT(*)::int as attempts
             FROM campaign_class_members cm
             JOIN campaign_players cp ON cp.auth_user_id = cm.student_auth_user_id
             JOIN campaign_quests cq ON cq.player_id = cp.id
             WHERE cm.class_id = $1 AND cq.status = 'failed'
             GROUP BY cm.student_auth_user_id, cq.quest_id
             HAVING COUNT(*) >= 3`,
            [classId]
        );

        for (const r of stuckResult.rows) {
            alerts.push({
                type: 'stuck_on_quiz',
                studentAuthUserId: r.student_auth_user_id,
                studentUsername: `user_${r.student_auth_user_id}`,
                message: `user_${r.student_auth_user_id} has failed quest "${r.quest_id}" ${r.attempts} times — may be stuck`,
                severity: 'warning',
                createdAt: now,
            });
        }

        return alerts;
    }

    // ========================================================================
    // ClosedPaw Chat (Stub for AI integration — Phase 6)
    // ========================================================================

    async askClosedPaw(_teacherAuthUserId: number, question: string): Promise<string> {
        // Stub — returns formatted response based on question keywords
        // Real AI integration via ClosedPaw comes in Phase 6
        const q = question.toLowerCase();

        if (q.includes('struggling') || q.includes('help') || q.includes('stuck')) {
            return `Based on the class data, I'd suggest:\n\n1. Review the student's quiz accuracy trend\n2. Check their penpal reply grades for grammar patterns\n3. Consider assigning a simpler quest to rebuild confidence\n\nWould you like me to generate a targeted assignment for the struggling student?`;
        }

        if (q.includes('progress') || q.includes('overview') || q.includes('report')) {
            return `Here's a quick summary of your class:\n\n- Most students are making steady progress\n- Average CEFR level: A2\n- Most completed quests are in the vocabulary category\n- Recommendation: Introduce more writing exercises to improve grammar scores\n\nShall I generate a detailed session report?`;
        }

        if (q.includes('assign') || q.includes('quest') || q.includes('homework')) {
            return `I can help create assignments! Here are some suggestions:\n\n1. **Vocabulary Builder** — Collect 10 new words from Ireland's penpal\n2. **Grammar Practice** — Complete the postcard writing quest\n3. **Reading Challenge** — Read and quiz on 3 newspaper articles\n\nWould you like me to create any of these as a class assignment?`;
        }

        if (q.includes('grammar') || q.includes('vocabulary') || q.includes('writing')) {
            return `For improving ${q.includes('grammar') ? 'grammar' : q.includes('vocabulary') ? 'vocabulary' : 'writing'}:\n\n1. The penpal system provides natural writing practice\n2. Newspaper articles expose students to native-level text\n3. Writing quests give structured prompts at appropriate CEFR levels\n\nI recommend a combination of penpal exchanges and writing quests for best results.`;
        }

        return `I'm ClosedPaw, your AI teaching assistant! I can help with:\n\n- **Student progress** — Ask me about individual students or class overview\n- **Assignments** — I can suggest or create quests for your class\n- **Struggling students** — I'll identify who needs extra help\n- **Teaching strategies** — Ask me about grammar, vocabulary, or writing tips\n\nWhat would you like to know?`;
    }
}
