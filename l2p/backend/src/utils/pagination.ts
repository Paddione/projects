import Joi from 'joi';

export type SortDir = 'ASC' | 'DESC';

export interface PaginationParams {
  limit: number;
  offset: number;
  sort: string; // validated against whitelist by caller
  dir: SortDir;
  q?: string;
}

export interface PaginatedResponseMeta {
  limit: number;
  offset: number;
  sort: { by: string; dir: SortDir };
  total: number;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function buildPaginationSchema(allowedSortFields: string[]) {
  return Joi.object({
    limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    offset: Joi.number().integer().min(0).default(0),
    sort: Joi.string().valid(...allowedSortFields).default('created_at'),
    dir: Joi.string().valid('ASC', 'DESC').insensitive().default('DESC'),
    q: Joi.string().allow('', null).optional(),
    lang: Joi.string().valid('en', 'de').optional(),
  });
}

// Ensure stable secondary sort by id ASC to maintain determinism
export function buildOrderBy(sort: string, dir: SortDir, idColumn: string = 'id'): string {
  const safeDir = dir === 'ASC' ? 'ASC' : 'DESC';
  const primary = `${sort} ${safeDir}`;
  const secondary = `${idColumn} ASC`;
  // If primary already sorts by id, keep only one
  if (sort === idColumn) return `${primary}`;
  return `${primary}, ${secondary}`;
}

export function parseDir(value: string | undefined): SortDir {
  return String(value).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
}
