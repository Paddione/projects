import { CategoryRepository, Category, CategoryWithCount } from '../repositories/CategoryRepository.js';

export class CategoryService {
  private categoryRepository: CategoryRepository;

  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  async getAllCategories(): Promise<CategoryWithCount[]> {
    return this.categoryRepository.findAll();
  }

  async getCategoryById(id: number): Promise<Category | null> {
    return this.categoryRepository.findCategoryById(id);
  }

  async createCategory(name: string): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 50) {
      throw new Error('Category name must be 1-50 characters');
    }
    const existing = await this.categoryRepository.findByName(trimmed);
    if (existing) {
      throw new Error('Category already exists');
    }
    return this.categoryRepository.createCategory(trimmed);
  }

  async updateCategory(id: number, name: string): Promise<Category | null> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 50) {
      throw new Error('Category name must be 1-50 characters');
    }
    const existing = await this.categoryRepository.findByName(trimmed);
    if (existing && existing.id !== id) {
      throw new Error('Category name already taken');
    }
    return this.categoryRepository.updateCategory(id, trimmed);
  }

  async deleteCategory(id: number): Promise<boolean> {
    const count = await this.categoryRepository.getQuestionCount(id);
    if (count > 0) {
      throw new Error(`Cannot delete category: ${count} question(s) still reference it`);
    }
    return this.categoryRepository.deleteCategory(id);
  }
}
