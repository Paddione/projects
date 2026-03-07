import express, { Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth.js';
import { GeminiService, QuestionGenerationRequest } from '../services/GeminiService.js';
import { QuestionService } from '../services/QuestionService.js';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// Initialize services
const geminiService = new GeminiService();
const questionService = new QuestionService();

// Get all question sets
router.get('/question-sets', async (req: Request, res: Response) => {
  try {
    const sets = await questionService.getAllQuestionSets(false);
    return res.json({
      success: true,
      data: sets
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
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid question set ID' });
    }

    const questionSet = await questionService.getQuestionSetById(id);
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        error: 'Question set not found'
      });
    }

    const questions = await questionService.getQuestionsBySetId(id);
    const data = {
      ...questionSet,
      questions: questions.map(q => ({
        ...q,
        answers: typeof q.answers === 'string' ? JSON.parse(q.answers as any) : q.answers
      }))
    };

    return res.json({
      success: true,
      data
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
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid question set ID' });
    }

    const stats = await questionService.getQuestionSetWithStats(id);
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Question set not found'
      });
    }

    return res.json({
      success: true,
      data: {
        total_questions: stats.questionCount,
        avg_difficulty: stats.averageDifficulty,
        min_difficulty: 0,
        max_difficulty: 0
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
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question set ID' });
    }

    const questions = await questionService.getQuestionsBySetId(id);
    return res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Create new question set
router.post('/question-sets', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { name, description, category, difficulty } = req.body;
    const validation = questionService.validateQuestionSetData({ name, description, category, difficulty });
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    const questionSet = await questionService.createQuestionSet({ name, description, category, difficulty });
    return res.status(201).json(questionSet);
  } catch (error) {
    console.error('Error creating question set:', error);
    return res.status(500).json({ error: 'Failed to create question set' });
  }
});

// Add question to set (creates question + links it)
router.post('/question-sets/:id/questions', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const setId = parseInt(req.params['id'] as string, 10);
    if (isNaN(setId)) {
      return res.status(400).json({ error: 'Invalid question set ID' });
    }

    const { question_text, answers, explanation, difficulty, answer_type, answer_metadata, hint } = req.body;

    // Validate using QuestionService
    const validation = questionService.validateQuestionData({
      question_text,
      answers: answers || [],
      explanation,
      difficulty,
      answer_type: answer_type || 'multiple_choice',
      hint,
      answer_metadata,
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    // Create the question
    const question = await questionService.createQuestion({
      question_text,
      answers,
      explanation,
      difficulty,
      answer_type: answer_type || 'multiple_choice',
      answer_metadata,
      hint,
    });

    // Link it to the set
    await questionService.addQuestionsToSet(setId, [question.id]);

    return res.status(201).json(question);
  } catch (error) {
    console.error('Error adding question:', error);
    return res.status(500).json({ error: 'Failed to add question' });
  }
});

// Update question set
router.put('/question-sets/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question set ID' });
    }

    const { name, description, category, difficulty, is_active } = req.body;
    const updated = await questionService.updateQuestionSet(id, { name, description, category, difficulty, is_active });

    if (!updated) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    return res.json(updated);
  } catch (error) {
    console.error('Error updating question set:', error);
    return res.status(500).json({ error: 'Failed to update question set' });
  }
});

// Update question
router.put('/questions/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const { question_text, answers, explanation, difficulty, answer_type, answer_metadata, hint } = req.body;

    // If answer_type or answers are provided, validate the full question data
    if (answer_type || answers) {
      const validation = questionService.validateQuestionData({
        question_text: question_text || '',
        answers: answers || [],
        explanation,
        difficulty,
        answer_type: answer_type || 'multiple_choice',
        hint,
        answer_metadata,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }
    }

    const updated = await questionService.updateQuestion(id, {
      question_text,
      answers,
      explanation,
      difficulty,
      answer_type: answer_type || 'multiple_choice',
      answer_metadata,
      hint,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Question not found' });
    }

    return res.json(updated);
  } catch (error) {
    console.error('Error updating question:', error);
    return res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question set (junction cascades automatically, questions preserved)
router.delete('/question-sets/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question set ID' });
    }

    const deleted = await questionService.deleteQuestionSet(id);
    if (!deleted) {
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
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const deleted = await questionService.deleteQuestion(id);
    if (!deleted) {
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
    const id = parseInt(req.params['id'] as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question set ID' });
    }

    const questionSet = await questionService.getQuestionSetById(id);
    if (!questionSet) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    const questions = await questionService.getQuestionsBySetId(id);

    const exportData = {
      questionSet,
      questions: questions.map(q => ({
        ...q,
        answers: typeof q.answers === 'string' ? JSON.parse(q.answers as any) : q.answers
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
    const { questionSet: qsInput, questions } = req.body;

    // Basic structure validation
    if (!qsInput) {
      return res.status(400).json({ error: 'Missing questionSet object in payload' });
    }
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Missing questions array or invalid format' });
    }

    // Validate questionSet fields
    if (!qsInput.name) {
      return res.status(400).json({ error: 'Question set name is required' });
    }

    // Extract only the fields that exist in the current schema
    const {
      name,
      description = '',
      category = 'General',
      difficulty = 'medium',
    } = qsInput;

    // Prepare question data list
    const questionDataList: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      try {
        // Handle question_text
        let questionText = question.question_text || question.questionText || '';
        if (typeof questionText === 'object' && questionText !== null) {
          questionText = questionText.de || questionText.en || Object.values(questionText)[0] || '';
        }

        if (!questionText) {
          errors.push(`Question ${i + 1}: Missing question text`);
          continue;
        }

        // Handle answers
        const questionAnswerType = question.answer_type || question.answerType || 'multiple_choice';
        const metadataBasedTypes = ['matching', 'ordering'];
        let answersData: any[] = question.answers || question.options || [];
        if (!Array.isArray(answersData)) answersData = [];

        if (metadataBasedTypes.includes(questionAnswerType)) {
          const metadata = question.answer_metadata || question.answerMetadata;
          if (!metadata) {
            errors.push(`Question ${i + 1}: ${questionAnswerType} type requires answer_metadata`);
            continue;
          }
        } else if (answersData.length < 2) {
          errors.push(`Question ${i + 1}: Must have at least 2 answers`);
          continue;
        }

        // Normalize answers format
        const normalizedAnswers = answersData.map((answer: any, animIdx: number) => {
          if (typeof answer === 'string') {
            return { text: answer, correct: animIdx === 0 };
          }
          return {
            text: answer.text || answer.answer_text || '',
            correct: !!(answer.correct || answer.is_correct || answer.isCorrect)
          };
        });

        if (!metadataBasedTypes.includes(questionAnswerType) && !normalizedAnswers.some((a: any) => a.correct)) {
          errors.push(`Question ${i + 1}: No correct answer specified`);
          continue;
        }

        // Handle explanation
        let explanation = question.explanation || '';
        if (typeof explanation === 'object' && explanation !== null) {
          explanation = explanation.de || explanation.en || Object.values(explanation)[0] || '';
        }

        const difficultyNum = Number(question.difficulty) || 1;
        const answerType = question.answer_type || question.answerType || 'multiple_choice';
        const answerMetadata = question.answer_metadata || question.answerMetadata || null;
        const hint = question.hint || null;

        questionDataList.push({
          question_text: questionText,
          answers: normalizedAnswers,
          explanation,
          difficulty: difficultyNum,
          answer_type: answerType,
          answer_metadata: answerMetadata,
          hint,
          category: category,
        });
      } catch (err) {
        console.error(`Error preparing question ${i + 1}:`, err);
        errors.push(`Question ${i + 1}: Error during preparation`);
      }
    }

    if (questionDataList.length === 0 && questions.length > 0) {
      return res.status(400).json({
        error: 'No questions could be imported',
        details: errors
      });
    }

    // Use createSetWithQuestions to create set + questions + links atomically
    const result = await questionService.createSetWithQuestions(
      { name, description, category, difficulty },
      questionDataList
    );

    return res.status(201).json({
      message: errors.length > 0
        ? `Imported with ${errors.length} errors`
        : 'Question set imported successfully',
      questionSetId: result.questionSet.id,
      questionsImported: result.questions.length,
      errors: errors.length > 0 ? errors : undefined,
      questionSet: result.questionSet
    });
  } catch (error) {
    console.error('Error importing question set:', error);
    return res.status(500).json({
      error: 'Failed to import question set',
      message: error instanceof Error ? error.message : 'Unknown server error'
    });
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
    const genResult = await geminiService.generateQuestions(request);

    if (!genResult.success) {
      return res.status(500).json({
        error: 'Failed to generate questions',
        details: genResult.error
      });
    }

    // Use createSetWithQuestions for atomic creation + linking
    const setData = geminiService.createQuestionSetData(request, genResult.questions);
    const questionData = geminiService.convertToQuestionData(genResult.questions);
    const result = await questionService.createSetWithQuestions(setData, questionData);

    return res.status(201).json({
      success: true,
      questionSet: result.questionSet,
      questions: result.questions,
      metadata: genResult.metadata,
      message: `Successfully generated ${result.questions.length} questions`
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

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        error: 'Invalid difficulty level. Must be one of: easy, medium, hard'
      });
    }

    if (questionCount < 1 || questionCount > 50) {
      return res.status(400).json({
        error: 'Question count must be between 1 and 50'
      });
    }

    const request: QuestionGenerationRequest = {
      topic,
      category,
      difficulty,
      questionCount,
      language,
      contextSource: 'manual',
      manualContext: content
    };

    const genResult = await geminiService.generateQuestions(request);

    if (!genResult.success) {
      return res.status(500).json({
        error: 'Failed to generate questions',
        details: genResult.error
      });
    }

    // Use createSetWithQuestions for atomic creation + linking
    const setData = geminiService.createQuestionSetData(request, genResult.questions);
    const questionData = geminiService.convertToQuestionData(genResult.questions);
    const result = await questionService.createSetWithQuestions(setData, questionData);

    return res.status(201).json({
      success: true,
      questionSet: result.questionSet,
      questions: result.questions,
      metadata: {
        ...genResult.metadata,
        sourceContent: content.substring(0, 100) + (content.length > 100 ? '...' : '')
      },
      message: `Successfully generated ${result.questions.length} questions from text content`
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

export default router;
