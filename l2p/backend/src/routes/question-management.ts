import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { AuthMiddleware } from '../middleware/auth.js';
import { GeminiService, QuestionGenerationRequest } from '../services/GeminiService.js';
import { QuestionService } from '../services/QuestionService.js';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// Initialize services
const geminiService = new GeminiService();
const questionService = new QuestionService();

// Database connection
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

// Get all question sets
router.get('/question-sets', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM question_sets ORDER BY name'
    );
    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching question sets:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch question sets'
    });
  }
});

// Get question set details with questions
router.get('/question-sets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get question set
    const setResult = await pool.query('SELECT * FROM question_sets WHERE id = $1', [id]);
    if (setResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Question set not found'
      });
    }

    // Get questions
    const questionsResult = await pool.query('SELECT * FROM questions WHERE question_set_id = $1 ORDER BY id', [id]);

    const questionSet = setResult.rows[0];
    questionSet.questions = questionsResult.rows.map(q => ({
      ...q,
      answers: typeof q.answers === 'string' ? JSON.parse(q.answers) : q.answers
    }));

    return res.json({
      success: true,
      data: questionSet
    });
  } catch (error) {
    console.error('Error fetching question set details:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch question set details'
    });
  }
});

// Get question set statistics
router.get('/question-sets/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_questions,
        COALESCE(AVG(difficulty), 0) as avg_difficulty,
        COALESCE(MIN(difficulty), 0) as min_difficulty,
        COALESCE(MAX(difficulty), 0) as max_difficulty
      FROM questions 
      WHERE question_set_id = $1
    `, [id]);

    if (statsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Question set not found'
      });
    }

    return res.json({
      success: true,
      data: {
        total_questions: parseInt(statsResult.rows[0].total_questions) || 0,
        avg_difficulty: parseFloat(statsResult.rows[0].avg_difficulty) || 0,
        min_difficulty: parseInt(statsResult.rows[0].min_difficulty) || 0,
        max_difficulty: parseInt(statsResult.rows[0].max_difficulty) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching question set stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch question set stats'
    });
  }
});

// Get questions by set ID
router.get('/question-sets/:id/questions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY id',
      [id]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Create new question set
router.post('/question-sets', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { name, description, category, difficulty } = req.body;

    const result = await pool.query(
      'INSERT INTO question_sets (name, description, category, difficulty) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, category, difficulty]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating question set:', error);
    return res.status(500).json({ error: 'Failed to create question set' });
  }
});

// Add question to set
router.post('/question-sets/:id/questions', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { question_text, answers, explanation, difficulty } = req.body;

    const result = await pool.query(
      'INSERT INTO questions (question_set_id, question_text, answers, explanation, difficulty) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, question_text, JSON.stringify(answers), explanation, difficulty]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding question:', error);
    return res.status(500).json({ error: 'Failed to add question' });
  }
});

// Update question set
router.put('/question-sets/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, difficulty, is_active } = req.body;

    const result = await pool.query(
      'UPDATE question_sets SET name = $1, description = $2, category = $3, difficulty = $4, is_active = $5 WHERE id = $6 RETURNING *',
      [name, description, category, difficulty, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating question set:', error);
    return res.status(500).json({ error: 'Failed to update question set' });
  }
});

// Update question
router.put('/questions/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { question_text, answers, explanation, difficulty } = req.body;

    const result = await pool.query(
      'UPDATE questions SET question_text = $1, answers = $2, explanation = $3, difficulty = $4 WHERE id = $5 RETURNING *',
      [question_text, JSON.stringify(answers), explanation, difficulty, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating question:', error);
    return res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question set
router.delete('/question-sets/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete questions first (due to foreign key constraint)
    await pool.query('DELETE FROM questions WHERE question_set_id = $1', [id]);

    const result = await pool.query('DELETE FROM question_sets WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    return res.json({ message: 'Question set deleted successfully' });
  } catch (error) {
    console.error('Error deleting question set:', error);
    return res.status(500).json({ error: 'Failed to delete question set' });
  }
});

// Delete question
router.delete('/questions/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    return res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Export question set
router.get('/question-sets/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get question set
    const setResult = await pool.query('SELECT * FROM question_sets WHERE id = $1', [id]);
    if (setResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    // Get questions
    const questionsResult = await pool.query('SELECT * FROM questions WHERE question_set_id = $1 ORDER BY id', [id]);

    const exportData = {
      questionSet: setResult.rows[0],
      questions: questionsResult.rows.map(q => ({
        ...q,
        answers: typeof q.answers === 'string' ? JSON.parse(q.answers) : q.answers
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="question-set-${id}.json"`);
    return res.json(exportData);
  } catch (error) {
    console.error('Error exporting question set:', error);
    return res.status(500).json({ error: 'Failed to export question set' });
  }
});

// Import question set
router.post('/question-sets/import', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { questionSet, questions } = req.body;

    // Basic structure validation
    if (!questionSet) {
      return res.status(400).json({ error: 'Missing questionSet object in payload' });
    }
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Missing questions array or invalid format' });
    }

    // Validate questionSet fields
    if (!questionSet.name) {
      return res.status(400).json({ error: 'Question set name is required' });
    }

    // Extract only the fields that exist in the current schema
    const {
      name,
      description = '',
      category = 'General',
      difficulty = 'medium',
      is_active = true
    } = questionSet;

    // Create question set
    const setResult = await pool.query(
      `INSERT INTO question_sets 
       (name, description, category, difficulty, is_active) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, description, category, difficulty, is_active]
    );

    const setId = setResult.rows[0].id;

    // Import questions with robust handling
    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      try {
        // Handle question_text - handle both string and object formats
        let questionText = question.question_text || question.questionText || '';
        if (typeof questionText === 'object' && questionText !== null) {
          questionText = questionText.de || questionText.en || Object.values(questionText)[0] || '';
        }

        if (!questionText) {
          errors.push(`Question ${i + 1}: Missing question text`);
          continue;
        }

        // Handle answers
        let answersData = question.answers || question.options || [];
        if (!Array.isArray(answersData) || answersData.length < 2) {
          errors.push(`Question ${i + 1}: Must have at least 2 answers`);
          continue;
        }

        // Normalize answers format
        const normalizedAnswers = answersData.map((answer, animIdx) => {
          if (typeof answer === 'string') {
            return { text: answer, correct: animIdx === 0 }; // Assume first is correct if simple string array
          }
          return {
            text: answer.text || answer.answer_text || '',
            correct: !!(answer.correct || answer.is_correct || answer.isCorrect)
          };
        });

        if (!normalizedAnswers.some(a => a.correct)) {
          errors.push(`Question ${i + 1}: No correct answer specified`);
          continue;
        }

        // Handle explanation
        let explanation = question.explanation || '';
        if (typeof explanation === 'object' && explanation !== null) {
          explanation = explanation.de || explanation.en || Object.values(explanation)[0] || '';
        }

        // Handle difficulty
        const difficultyNum = Number(question.difficulty) || 1;

        await pool.query(
          'INSERT INTO questions (question_set_id, question_text, answers, explanation, difficulty) VALUES ($1, $2, $3, $4, $5)',
          [
            setId,
            questionText,
            JSON.stringify(normalizedAnswers),
            explanation,
            difficultyNum
          ]
        );
        importedCount++;
      } catch (err) {
        console.error(`Error importing individual question ${i + 1}:`, err);
        errors.push(`Question ${i + 1}: Database error during insertion`);
      }
    }

    if (importedCount === 0 && questions.length > 0) {
      // Clean up the empty question set since no questions were imported
      await pool.query('DELETE FROM question_sets WHERE id = $1', [setId]);
      return res.status(400).json({
        error: 'No questions could be imported',
        details: errors
      });
    }

    return res.status(201).json({
      message: errors.length > 0
        ? `Imported with ${errors.length} errors`
        : 'Question set imported successfully',
      questionSetId: setId,
      questionsImported: importedCount,
      errors: errors.length > 0 ? errors : undefined,
      questionSet: setResult.rows[0]
    });
  } catch (error) {
    console.error('Error importing question set:', error);
    return res.status(500).json({
      error: 'Failed to import question set',
      message: error instanceof Error ? error.message : 'Unknown server error'
    });
  }
});

// Get question statistics
router.get('/question-sets/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_questions,
        AVG(difficulty) as avg_difficulty,
        MIN(difficulty) as min_difficulty,
        MAX(difficulty) as max_difficulty
      FROM questions 
      WHERE question_set_id = $1
    `, [id]);

    return res.json(statsResult.rows[0]);
  } catch (error) {
    console.error('Error fetching question statistics:', error);
    return res.status(500).json({ error: 'Failed to fetch question statistics' });
  }
});

// AI Question Generation Endpoints

// Generate questions using Gemini AI
router.post('/question-sets/generate', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const request: QuestionGenerationRequest = req.body;

    // Validate request
    const validation = geminiService.validateGenerationRequest(request);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.errors
      });
    }

    // Generate questions
    const result = await geminiService.generateQuestions(request);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to generate questions',
        details: result.error
      });
    }

    // Create question set
    const questionSetData = geminiService.createQuestionSetData(request, result.questions);
    const questionSet = await questionService.createQuestionSet(questionSetData);

    // Add questions to the set
    const questionData = geminiService.convertToQuestionData(result.questions, questionSet.id);
    const createdQuestions = [];

    for (const qData of questionData) {
      const question = await questionService.createQuestion(qData);
      createdQuestions.push(question);
    }

    return res.status(201).json({
      success: true,
      questionSet,
      questions: createdQuestions,
      metadata: result.metadata,
      message: `Successfully generated ${createdQuestions.length} questions`
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    return res.status(500).json({
      error: 'Failed to generate questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate questions from text content using Gemini AI
router.post('/question-sets/generate-from-text', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { topic, category, difficulty, questionCount, language, content } = req.body;

    // Validate required fields
    if (!topic || !category || !difficulty || !questionCount || !language || !content) {
      return res.status(400).json({
        error: 'Missing required fields: topic, category, difficulty, questionCount, language, content'
      });
    }

    // Validate difficulty
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        error: 'Invalid difficulty level. Must be one of: easy, medium, hard'
      });
    }

    // Validate question count
    if (questionCount < 1 || questionCount > 50) {
      return res.status(400).json({
        error: 'Question count must be between 1 and 50'
      });
    }

    // Create request object for Gemini service
    const request: QuestionGenerationRequest = {
      topic,
      category,
      difficulty,
      questionCount,
      language,
      contextSource: 'manual',
      manualContext: content
    };

    // Generate questions
    const result = await geminiService.generateQuestions(request);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to generate questions',
        details: result.error
      });
    }

    // Create question set
    const questionSetData = geminiService.createQuestionSetData(request, result.questions);
    const questionSet = await questionService.createQuestionSet(questionSetData);

    // Add questions to the set
    const questionData = geminiService.convertToQuestionData(result.questions, questionSet.id);
    const createdQuestions = [];

    for (const qData of questionData) {
      const question = await questionService.createQuestion(qData);
      createdQuestions.push(question);
    }

    return res.status(201).json({
      success: true,
      questionSet,
      questions: createdQuestions,
      metadata: {
        ...result.metadata,
        sourceContent: content.substring(0, 100) + (content.length > 100 ? '...' : '')
      },
      message: `Successfully generated ${createdQuestions.length} questions from text content`
    });
  } catch (error) {
    console.error('Error generating questions from text:', error);
    return res.status(500).json({
      error: 'Failed to generate questions from text',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test Gemini API connection
router.get('/ai/test-gemini', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const result = await geminiService.testConnection();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ChromaDB endpoints removed - no longer needed

export default router; 
