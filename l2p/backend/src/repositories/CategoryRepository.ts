import { BaseRepository } from './BaseRepository.js';

export interface Category {
  id: number;
  name: string;
  created_at: Date;
}

export interface CategoryWithCount extends Category {
  question_count: number;
}

export class CategoryRepository extends BaseRepository {
  private readonly table = 'categories';

  async findAllCategories(): Promise<CategoryWithCount[]> {
    const result = await this.getDb().query<CategoryWithCount>(
      `SELECT c.*, COUNT(q.id)::int AS question_count
       FROM categories c
       LEFT JOIN questions q ON q.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    );
    return result.rows;
  }

  async findCategoryById(id: number): Promise<Category | null> {
    return this.findById<Category>(this.table, id);
  }

  async findByName(name: string): Promise<Category | null> {
    const result = await this.getDb().query<Category>(
      `SELECT * FROM ${this.table} WHERE name = $1`, [name]
    );
    return result.rows[0] || null;
  }

  async createCategory(name: string): Promise<Category> {
    return this.create<Category>(this.table, { name });
  }

  async updateCategory(id: number, name: string): Promise<Category | null> {
    return this.update<Category>(this.table, id, { name });
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.delete(this.table, id);
  }

  async getQuestionCount(id: number): Promise<number> {
    const result = await this.getDb().query<{ count: string }>(
      `SELECT COUNT(*) as count FROM questions WHERE category_id = $1`, [id]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }
}
