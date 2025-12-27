#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the question set JSON file
const questionSetPath = path.join(__dirname, '..', 'it-security-questions.json');

// Check if the file exists
if (!fs.existsSync(questionSetPath)) {
    console.error('❌ Question set file not found:', questionSetPath);
    console.log('Please create the file with your question set data first.');
    process.exit(1);
}

// Read and parse the JSON file
try {
    const questionSetData = JSON.parse(fs.readFileSync(questionSetPath, 'utf8'));

    console.log('📖 Question set data loaded successfully:');
    console.log(`   Name: ${questionSetData.questionSet.name}`);
    console.log(`   Category: ${questionSetData.questionSet.category}`);
    console.log(`   Difficulty: ${questionSetData.questionSet.difficulty}`);
    console.log(`   Questions: ${questionSetData.questions.length}`);

    // Validate the data structure
    if (!questionSetData.questionSet || !questionSetData.questions) {
        throw new Error('Invalid data structure: missing questionSet or questions');
    }

    if (!Array.isArray(questionSetData.questions)) {
        throw new Error('Questions must be an array');
    }

    // Validate each question
    for (let i = 0; i < questionSetData.questions.length; i++) {
        const question = questionSetData.questions[i];
        if (!question.question_text || !question.answers || !Array.isArray(question.answers)) {
            throw new Error(`Question ${i + 1} is missing required fields`);
        }

        if (question.answers.length === 0) {
            throw new Error(`Question ${i + 1} has no answers`);
        }

        const correctAnswers = question.answers.filter(a => a.correct);
        if (correctAnswers.length === 0) {
            throw new Error(`Question ${i + 1} has no correct answer`);
        }

        if (correctAnswers.length > 1) {
            console.log(`⚠️  Question ${i + 1} has multiple correct answers (${correctAnswers.length})`);
        }
    }

    console.log('✅ Data validation passed!');
    console.log('');
    console.log('📋 To import this question set, you have several options:');
    console.log('');
    console.log('1. Use the API endpoint (requires authentication):');
    console.log('   POST /api/question-management/question-sets/import');
    console.log('   Body: Your JSON data');
    console.log('');
    console.log('2. Use the database CLI (if available):');
    console.log('   npm run db:import-questions');
    console.log('');
    console.log('3. Import directly via database:');
    console.log('   - Connect to your database');
    console.log('   - Insert into question_sets table');
    console.log('   - Insert into questions table');
    console.log('');
    console.log('🔑 Note: The API endpoint requires authentication and an owner_id.');
    console.log('   You may need to create a user account first or modify the import logic.');

} catch (error) {
    console.error('❌ Error processing question set:', error.message);
    process.exit(1);
}
