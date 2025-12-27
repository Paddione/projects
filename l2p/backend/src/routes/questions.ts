import express from 'express';
import { QuestionService } from '../services/QuestionService.js';
import { ValidationMiddleware } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { buildPaginationSchema, parseDir } from '../utils/pagination.js';

const router = express.Router();
const questionService = new QuestionService();

// Pagination schemas and sort whitelists per endpoint
const allowedSetSortFields = ['name', 'created_at', 'updated_at'] as const;
const allowedQuestionSortFields = ['id', 'difficulty', 'created_at'] as const;
const setPaginationSchema = buildPaginationSchema(allowedSetSortFields as unknown as string[]);
const questionPaginationSchema = buildPaginationSchema(allowedQuestionSortFields as unknown as string[]);

// Small helper to add short-lived caching
function setShortCache(res: express.Response, seconds: number = 30) {
  res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds * 2}, stale-while-revalidate=${seconds * 2}`);
}

// Get question statistics
router.get('/stats', asyncHandler(async (req: express.Request, res: express.Response) => {
  const stats = await questionService.getQuestionSetStats();
  setShortCache(res, 60);
  res.json({
    success: true,
    data: stats
  });
}));

// Get available categories
router.get('/categories', asyncHandler(async (req: express.Request, res: express.Response) => {
  const categories = await questionService.getAvailableCategories();
  setShortCache(res, 300);
  res.json({
    success: true,
    data: categories
  });
}));

// Get all question sets (supports pagination/sorting/filtering)
router.get('/sets', asyncHandler(async (req: express.Request, res: express.Response) => {
  const q = req.query as Record<string, unknown>;
  const activeOnly = q['active'] !== 'false';
  const page = q['page'] ? parseInt(q['page'] as string, 10) : undefined; // legacy
  const pageSize = q['pageSize'] ? parseInt(q['pageSize'] as string, 10) : undefined; // legacy
  const sortBy = (q['sortBy'] as 'name' | 'created_at' | 'updated_at' | 'is_featured') || undefined; // legacy
  const sortDir = (q['sortDir'] as 'ASC' | 'DESC') || undefined; // legacy
  const category = (q['category'] as string) || undefined;

  // New standardized pagination using limit/offset/sort/dir
  const wantsStandardPagination =
    typeof q['limit'] !== 'undefined' ||
    typeof q['offset'] !== 'undefined' ||
    typeof q['sort'] !== 'undefined' ||
    typeof q['dir'] !== 'undefined';

  if (wantsStandardPagination || page || pageSize || sortBy || sortDir || category || q['publicOnly']) {
    const publicOnly = q['publicOnly'] === 'true';

    // Prefer standardized query if provided; otherwise map legacy page/pageSize/sortBy/sortDir
    let limit: number;
    let offset: number;
    let sort: string;
    let dir: 'ASC' | 'DESC';

    if (wantsStandardPagination) {
      const { value, error } = setPaginationSchema.validate(q);
      if (error) {
        throw new ValidationError('Invalid pagination query');
      }
      limit = value.limit;
      offset = value.offset;
      sort = value.sort;
      dir = parseDir(value.dir);
    } else {
      const _page = Math.max(1, page || 1);
      const _pageSize = Math.min(100, Math.max(1, pageSize || 20));
      limit = _pageSize;
      offset = (_page - 1) * _pageSize;
      sort = (sortBy || 'created_at') as string;
      dir = (sortDir === 'ASC' ? 'ASC' : 'DESC');
    }

    const result = await questionService.getQuestionSetsPaginated({
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      sortBy: sort as any,
      sortDir: dir,
      activeOnly,
      ...(category !== undefined ? { category } : {}),
    });
    setShortCache(res, 30);
    return res.json({
      success: true,
      // Standardized shape
      items: result.items,
      total: result.total,
      limit,
      offset,
      sort: { by: sort, dir },
      // Legacy pagination object retained for compatibility
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
        pages: Math.max(1, Math.ceil(result.total / limit)),
      }
    });
  }

  const questionSets = await questionService.getAllQuestionSetsWithStats(activeOnly);
  setShortCache(res, 30);
  return res.json({ success: true, data: questionSets });
}));

// Get question set by ID
router.get('/sets/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) {
    throw new ValidationError('Invalid question set ID');
  }

  const questionSet = await questionService.getQuestionSetWithStats(id);
  if (!questionSet) {
    res.status(404).json({
      success: false,
      error: 'Question set not found'
    });
    return;
  }
  setShortCache(res, 60);
  res.json({
    success: true,
    data: questionSet
  });
}));

// Get question sets by category
router.get('/sets/category/:category', asyncHandler(async (req: express.Request, res: express.Response) => {
  const category = req.params['category'] || '';
  const questionSets = await questionService.getQuestionSetsByCategory(category);
  setShortCache(res, 30);
  res.json({
    success: true,
    data: questionSets
  });
}));

// Create question set
router.post('/sets', ValidationMiddleware.validate({
  body: ValidationMiddleware.schemas.createQuestionSet.body
}), asyncHandler(async (req: express.Request, res: express.Response) => {
  const validation = questionService.validateQuestionSetData(req.body);
  if (!validation.isValid) {
    throw new ValidationError('Invalid question set data', validation.errors);
  }

  const questionSet = await questionService.createQuestionSet(req.body);

  res.status(201).json({
    success: true,
    data: questionSet
  });
}));

// Update question set
router.put('/sets/:id', ValidationMiddleware.validate({
  body: ValidationMiddleware.schemas.updateQuestionSet.body
}), asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) {
    throw new ValidationError('Invalid question set ID');
  }

  const questionSet = await questionService.updateQuestionSet(id, req.body);
  if (!questionSet) {
    res.status(404).json({
      success: false,
      error: 'Question set not found'
    });
    return;
  }

  res.json({
    success: true,
    data: questionSet
  });
}));

// Delete question set
router.delete('/sets/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) {
    throw new ValidationError('Invalid question set ID');
  }

  const deleted = await questionService.deleteQuestionSet(id);
  if (!deleted) {
    res.status(404).json({
      success: false,
      error: 'Question set not found'
    });
    return;
  }

  res.json({ success: true });
}));

// Get questions by set ID (supports pagination/sorting)
router.get('/sets/:id/questions', asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) {
    throw new ValidationError('Invalid question set ID');
  }

  const language = 'de' as const;
  const q2 = req.query as Record<string, unknown>;
  const page = q2['page'] ? parseInt(q2['page'] as string, 10) : undefined; // legacy
  const pageSize = q2['pageSize'] ? parseInt(q2['pageSize'] as string, 10) : undefined; // legacy
  const sortBy = (q2['sortBy'] as 'id' | 'difficulty' | 'created_at') || undefined; // legacy
  const sortDir = (q2['sortDir'] as 'ASC' | 'DESC') || undefined; // legacy

  const wantsStandardPagination =
    typeof q2['limit'] !== 'undefined' ||
    typeof q2['offset'] !== 'undefined' ||
    typeof q2['sort'] !== 'undefined' ||
    typeof q2['dir'] !== 'undefined';

  if (wantsStandardPagination || page || pageSize || sortBy || sortDir) {
    let limit: number;
    let offset: number;
    let sort: string;
    let dir: 'ASC' | 'DESC';

    if (wantsStandardPagination) {
      const { value, error } = questionPaginationSchema.validate(q2);
      if (error) throw new ValidationError('Invalid pagination query');
      limit = value.limit;
      offset = value.offset;
      sort = value.sort;
      dir = parseDir(value.dir);
    } else {
      const _page = Math.max(1, page || 1);
      const _pageSize = Math.min(100, Math.max(1, pageSize || 20));
      limit = _pageSize;
      offset = (_page - 1) * _pageSize;
      sort = (sortBy || 'created_at') as string;
      dir = (sortDir === 'ASC' ? 'ASC' : 'DESC');
    }

    const result = await questionService.getQuestionsBySetIdPaginated(id, {
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      sortBy: sort as any,
      sortDir: dir,
    });
    const localized = await questionService.getLocalizedQuestions(result.items, language);
    setShortCache(res, 30);
    return res.json({
      success: true,
      items: localized,
      total: result.total,
      limit,
      offset,
      sort: { by: sort, dir },
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
        pages: Math.max(1, Math.ceil(result.total / limit)),
      }
    });
  }

  const questions = await questionService.getQuestionsBySetId(id);
  const localizedQuestions = await questionService.getLocalizedQuestions(questions, language);
  setShortCache(res, 30);
  return res.json({ success: true, data: localizedQuestions });
}));

// Get random questions
router.post('/random', ValidationMiddleware.validate({
  body: ValidationMiddleware.schemas.getRandomQuestions.body
}), asyncHandler(async (req: express.Request, res: express.Response) => {
  const { questionSetIds, count, difficulty, excludeIds } = req.body;
  const language = 'de' as const;

  const questions = await questionService.getRandomQuestions({
    questionSetIds,
    count,
    difficulty,
    excludeIds
  });

  const localizedQuestions = await questionService.getLocalizedQuestions(questions, language);

  res.json({
    success: true,
    data: localizedQuestions
  });
}));

// Search questions (supports pagination/sorting)
router.get('/search', asyncHandler(async (req: express.Request, res: express.Response) => {
  const q3 = req.query as Record<string, unknown>;
  const searchTerm = q3['q'] as string;
  const questionSetId = q3['setId'] ? parseInt(q3['setId'] as string) : undefined;
  const language = 'de' as const;

  if (!searchTerm) {
    throw new ValidationError('Search term is required');
  }

  const page = q3['page'] ? parseInt(q3['page'] as string, 10) : undefined; // legacy
  const pageSize = q3['pageSize'] ? parseInt(q3['pageSize'] as string, 10) : undefined; // legacy
  const sortBy = (q3['sortBy'] as 'id' | 'difficulty' | 'created_at') || undefined; // legacy
  const sortDir = (q3['sortDir'] as 'ASC' | 'DESC') || undefined; // legacy

  const wantsStandardPagination =
    typeof q3['limit'] !== 'undefined' ||
    typeof q3['offset'] !== 'undefined' ||
    typeof q3['sort'] !== 'undefined' ||
    typeof q3['dir'] !== 'undefined';

  if (wantsStandardPagination || page || pageSize || sortBy || sortDir) {
    let limit: number;
    let offset: number;
    let sort: string;
    let dir: 'ASC' | 'DESC';

    if (wantsStandardPagination) {
      const { value, error } = questionPaginationSchema.validate(q3);
      if (error) throw new ValidationError('Invalid pagination query');
      limit = value.limit;
      offset = value.offset;
      sort = value.sort;
      dir = parseDir(value.dir);
    } else {
      const _page = Math.max(1, page || 1);
      const _pageSize = Math.min(100, Math.max(1, pageSize || 20));
      limit = _pageSize;
      offset = (_page - 1) * _pageSize;
      sort = (sortBy || 'created_at') as string;
      dir = (sortDir === 'ASC' ? 'ASC' : 'DESC');
    }

    const result = await questionService.searchQuestionsPaginated(searchTerm, {
      ...(questionSetId !== undefined ? { questionSetId } : {}),
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      sortBy: sort as any,
      sortDir: dir,
    });
    const localized = await questionService.getLocalizedQuestions(result.items, language);
    setShortCache(res, 30);
    return res.json({
      success: true,
      items: localized,
      total: result.total,
      limit,
      offset,
      sort: { by: sort, dir },
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
        pages: Math.max(1, Math.ceil(result.total / limit)),
      }
    });
  }

  const questions = await questionService.searchQuestions(searchTerm, questionSetId);
  const localizedQuestions = await questionService.getLocalizedQuestions(questions, language);
  setShortCache(res, 30);
  return res.json({ success: true, data: localizedQuestions });
}));

// Get question by ID
router.get('/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) {
    throw new ValidationError('Invalid question ID');
  }

  const language = 'de' as const;
  const question = await questionService.getQuestionById(id);

  if (!question) {
    res.status(404).json({
      success: false,
      error: 'Question not found'
    });
    return;
  }

  const localizedQuestion = questionService.getLocalizedQuestion(question, language);

  res.json({
    success: true,
    data: localizedQuestion
  });
}));

// Create question
router.post('/', ValidationMiddleware.validate({
  body: ValidationMiddleware.schemas.createQuestion.body
}), asyncHandler(async (req: express.Request, res: express.Response) => {
  const validation = questionService.validateQuestionData(req.body);
  if (!validation.isValid) {
    throw new ValidationError('Invalid question data', validation.errors);
  }

  const question = await questionService.createQuestion(req.body);

  res.status(201).json({
    success: true,
    data: question
  });
}));

// Update question
router.put('/:id', ValidationMiddleware.validate({
  body: ValidationMiddleware.schemas.updateQuestion.body
}), asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) {
    throw new ValidationError('Invalid question ID');
  }

  const question = await questionService.updateQuestion(id, req.body);
  if (!question) {
    res.status(404).json({
      success: false,
      error: 'Question not found'
    });
    return;
  }

  res.json({
    success: true,
    data: question
  });
}));

// Delete question
router.delete('/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) {
    throw new ValidationError('Invalid question ID');
  }

  const deleted = await questionService.deleteQuestion(id);
  if (!deleted) {
    res.status(404).json({
      success: false,
      error: 'Question not found'
    });
    return;
  }

  res.json({
    success: true,
    message: 'Question deleted successfully'
  });
}));

export default router; 
