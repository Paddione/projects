#!/usr/bin/env node

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - use production environment for database connection
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

// Database connection - use localhost:5433 for host machine access
const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: process.env.POSTGRES_DB || 'learn2play',
    user: process.env.POSTGRES_USER || 'l2p_user',
    password: process.env.POSTGRES_PASSWORD,
    ssl: false
});

async function verifyImport() {
    try {
        console.log('🔍 Verifying imported question set...');

        // Get the question set
        const questionSetResult = await pool.query(
            'SELECT * FROM question_sets WHERE name = $1',
            ['IT-Sicherheit: Datenspeicherung und Backup SDA04-claude']
        );

        if (questionSetResult.rows.length === 0) {
            console.log('❌ Question set not found!');
            return;
        }

        const questionSet = questionSetResult.rows[0];
        console.log(`✅ Question set found with ID: ${questionSet.id}`);
        console.log(`   Name: ${questionSet.name}`);
        console.log(`   Category: ${questionSet.category}`);
        console.log(`   Difficulty: ${questionSet.difficulty}`);
        console.log(`   Active: ${questionSet.is_active}`);
        console.log(`   Created: ${questionSet.created_at}`);
        console.log(`   Updated: ${questionSet.updated_at}`);

        // Get the questions
        const questionsResult = await pool.query(
            'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY id',
            [questionSet.id]
        );

        console.log(`\n📝 Found ${questionsResult.rows.length} questions:`);

        for (let i = 0; i < questionsResult.rows.length; i++) {
            const question = questionsResult.rows[i];
            let answers;
            let correctAnswers = 0;

            try {
                // Handle different answer formats
                if (typeof question.answers === 'string') {
                    answers = JSON.parse(question.answers);
                } else if (Array.isArray(question.answers)) {
                    answers = question.answers;
                } else {
                    answers = [];
                    console.log(`      ⚠️  Question ${i + 1}: Unexpected answers format: ${typeof question.answers}`);
                }

                if (Array.isArray(answers)) {
                    correctAnswers = answers.filter(a => a.correct).length;
                }
            } catch (error) {
                console.log(`      ⚠️  Question ${i + 1}: Error parsing answers: ${error.message}`);
                answers = [];
            }

            console.log(`   ${i + 1}. ${question.question_text.substring(0, 60)}...`);
            console.log(`      Answers: ${answers.length}, Correct: ${correctAnswers}, Difficulty: ${question.difficulty}`);
        }

        // Get some statistics
        const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_questions,
        COALESCE(AVG(difficulty), 0) as avg_difficulty,
        COALESCE(MIN(difficulty), 0) as min_difficulty,
        COALESCE(MAX(difficulty), 0) as max_difficulty
      FROM questions 
      WHERE question_set_id = $1
    `, [questionSet.id]);

        if (statsResult.rows.length > 0) {
            const stats = statsResult.rows[0];
            console.log(`\n📊 Statistics:`);
            console.log(`   Total questions: ${stats.total_questions}`);
            console.log(`   Average difficulty: ${parseFloat(stats.avg_difficulty).toFixed(1)}`);
            console.log(`   Difficulty range: ${stats.min_difficulty} - ${stats.max_difficulty}`);
        }

        console.log('\n🎉 Verification completed successfully!');

    } catch (error) {
        console.error('❌ Error during verification:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the verification
verifyImport().catch(console.error);
