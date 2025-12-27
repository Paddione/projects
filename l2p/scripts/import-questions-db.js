#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

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

async function importQuestionSet() {
  const questionSetPath = path.join(__dirname, '..', 'it-security-questions.json');

  // Check if the file exists
  if (!fs.existsSync(questionSetPath)) {
    console.error('❌ Question set file not found:', questionSetPath);
    console.log('Please create the file with your question set data first.');
    process.exit(1);
  }

  try {
    // Read and parse the JSON file
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
    }

    console.log('✅ Data validation passed!');

    // Check if question set already exists
    const existingSet = await pool.query(
      'SELECT id FROM question_sets WHERE name = $1',
      [questionSetData.questionSet.name]
    );

    if (existingSet.rows.length > 0) {
      console.log(`⚠️  Question set "${questionSetData.questionSet.name}" already exists with ID ${existingSet.rows[0].id}`);
      const answer = await askQuestion('Do you want to update the existing question set? (y/N): ');
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Import cancelled.');
        process.exit(0);
      }

      // Delete existing questions
      await pool.query('DELETE FROM questions WHERE question_set_id = $1', [existingSet.rows[0].id]);
      console.log('🗑️  Existing questions deleted.');

      // Update question set
      await pool.query(
        `UPDATE question_sets 
         SET description = $1, category = $2, difficulty = $3, is_active = $4, updated_at = NOW()
         WHERE id = $5`,
        [
          questionSetData.questionSet.description,
          questionSetData.questionSet.category,
          questionSetData.questionSet.difficulty,
          questionSetData.questionSet.is_active,
          existingSet.rows[0].id
        ]
      );

      const setId = existingSet.rows[0].id;
      console.log(`🔄 Question set updated with ID: ${setId}`);

      // Import questions
      await importQuestions(setId, questionSetData.questions);

    } else {
      // Create new question set
      const setResult = await pool.query(
        `INSERT INTO question_sets 
         (name, description, category, difficulty, is_active, is_public, is_featured, tags, metadata, owner_id, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) 
         RETURNING *`,
        [
          questionSetData.questionSet.name,
          questionSetData.questionSet.description,
          questionSetData.questionSet.category,
          questionSetData.questionSet.difficulty,
          questionSetData.questionSet.is_active,
          true, // is_public
          false, // is_featured
          JSON.stringify([]), // tags
          JSON.stringify({}), // metadata
          1 // owner_id (default to user ID 1)
        ]
      );

      const setId = setResult.rows[0].id;
      console.log(`✅ Question set created with ID: ${setId}`);

      // Import questions
      await importQuestions(setId, questionSetData.questions);
    }

    console.log('🎉 Import completed successfully!');

  } catch (error) {
    console.error('❌ Error during import:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function importQuestions(setId, questions) {
  console.log(`📝 Importing ${questions.length} questions...`);

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    try {
      // Handle answers data
      let answersData = question.answers;
      if (Array.isArray(answersData) && answersData.length > 0 && answersData[0].id) {
        // Convert from detailed format to simple format for storage
        answersData = answersData.map(answer => ({
          text: answer.text,
          correct: answer.correct
        }));
      }

      // Handle question_text - store as plain string for monolingual use
      let questionText = question.question_text;
      if (typeof questionText === 'object' && questionText !== null) {
        // Extract text from object format (prefer German, fallback to English)
        questionText = questionText.de || questionText.en || Object.values(questionText)[0] || '';
      }

      // Handle explanation - store as plain string for monolingual use
      let explanation = question.explanation;
      if (typeof explanation === 'object' && explanation !== null) {
        // Extract text from object format (prefer German, fallback to English)
        explanation = explanation.de || explanation.en || Object.values(explanation)[0] || '';
      }

      await pool.query(
        'INSERT INTO questions (question_set_id, question_text, answers, explanation, difficulty, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [
          setId,
          questionText,
          JSON.stringify(answersData),
          explanation,
          question.difficulty || 1
        ]
      );

      process.stdout.write(`\r📝 Imported question ${i + 1}/${questions.length}`);

    } catch (error) {
      console.error(`\n❌ Error importing question ${i + 1}:`, error.message);
      throw error;
    }
  }

  console.log(`\n✅ All ${questions.length} questions imported successfully!`);
}

async function askQuestion(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

// Run the import
importQuestionSet().catch(console.error);
