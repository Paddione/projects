import express from 'express';
import { CategoryService } from '../services/CategoryService.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();
const categoryService = new CategoryService();

// GET /api/categories — list all with question counts
router.get('/', asyncHandler(async (_req: express.Request, res: express.Response) => {
  const categories = await categoryService.getAllCategories();
  res.json({ success: true, data: categories });
}));

// POST /api/categories — create
router.post('/', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    throw new ValidationError('name is required');
  }
  try {
    const category = await categoryService.createCategory(name);
    res.status(201).json({ success: true, data: category });
  } catch (err: any) {
    throw new ValidationError(err.message);
  }
}));

// PUT /api/categories/:id — rename
router.put('/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) throw new ValidationError('Invalid category ID');
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    throw new ValidationError('name is required');
  }
  try {
    const category = await categoryService.updateCategory(id, name);
    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.json({ success: true, data: category });
  } catch (err: any) {
    throw new ValidationError(err.message);
  }
}));

// DELETE /api/categories/:id — delete (only if no questions reference it)
router.delete('/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params['id'] || '');
  if (isNaN(id)) throw new ValidationError('Invalid category ID');
  try {
    const deleted = await categoryService.deleteCategory(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.json({ success: true, message: 'Category deleted' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}));

export default router;
