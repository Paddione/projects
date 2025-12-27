import { sql } from 'drizzle-orm';
import { pgTable, text, varchar, jsonb, bigint, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import type { VideoShape, FilterPreset, VideoThumbnail } from '@shared/types';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Videos persisted for all users (shared library)
export const videos = pgTable(
  'videos',
  {
    id: varchar('id').primaryKey(),
    filename: text('filename').notNull(),
    displayName: text('display_name').notNull(),
    path: text('path').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    lastModified: timestamp('last_modified', { withTimezone: false }).notNull(),
    metadata: jsonb('metadata').$type<VideoShape['metadata']>().notNull(),
    categories: jsonb('categories').$type<VideoShape['categories']>().notNull(),
    customCategories: jsonb('custom_categories').$type<VideoShape['customCategories']>().notNull(),
    thumbnail: jsonb('thumbnail').$type<VideoThumbnail | null>(),
    rootKey: text('root_key'),
    hashFast: text('hash_fast'),
    hashPerceptual: text('hash_perceptual'),
  },
  (table) => {
    return {
      idxVideosPath: index('idx_videos_path').on(table.path),
      idxVideosLastModified: index('idx_videos_last_modified').on(table.lastModified),
      idxVideosSize: index('idx_videos_size').on(table.size),
      idxVideosPathLastModified: index('idx_videos_path_last_modified').on(
        table.path,
        table.lastModified,
      ),
      idxVideosCategoriesGin: index('idx_videos_categories_gin').on(table.categories),
      idxVideosCustomCategoriesGin: index('idx_videos_custom_categories_gin').on(
        table.customCategories,
      ),
      idxVideosHashFast: index('idx_videos_hash_fast').on(table.hashFast),
      idxVideosHashPerceptual: index('idx_videos_hash_perceptual').on(table.hashPerceptual),
    };
  },
);

// Directory roots and their tracked directories
export const directoryRoots = pgTable('directory_roots', {
  rootKey: text('root_key').primaryKey(),
  name: text('name').notNull(),
  // Stored as array in JSONB for flexibility
  directories: jsonb('directories').$type<string[]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .default(sql`now()`)
    .notNull(),
});

// App-level settings (e.g., last_root_key)
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .default(sql`now()`)
    .notNull(),
});

// Filter presets (shared across users)
export const filterPresets = pgTable('filter_presets', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
  payload: jsonb('payload').$type<FilterPreset>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: false })
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .default(sql`now()`)
    .notNull(),
});

// Client error logs (admin)
export const clientErrors = pgTable('client_errors', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  errorId: text('error_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: false })
    .default(sql`now()`)
    .notNull(),
  message: text('message').notNull(),
  code: text('code').notNull(),
  severity: text('severity').notNull(),
  context: jsonb('context')
    .$type<Record<string, unknown> | null>()
    .default(sql`null`),
  userAgent: text('user_agent'),
  url: text('url'),
  stack: text('stack'),
  requestId: text('request_id'),
  ip: text('ip'),
});

export type DBVideo = typeof videos.$inferSelect;
export type InsertDBVideo = typeof videos.$inferInsert;
export type DirectoryRoot = typeof directoryRoots.$inferSelect;
export type InsertDirectoryRoot = typeof directoryRoots.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;
export type DBFilterPreset = typeof filterPresets.$inferSelect;
export type InsertDBFilterPreset = typeof filterPresets.$inferInsert;
export type DBClientError = typeof clientErrors.$inferSelect;
export type InsertDBClientError = typeof clientErrors.$inferInsert;

// Tag library (pre-defined tags with metadata)
export const tags = pgTable(
  'tags',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    type: text('type').default('general').notNull(),
    url: text('url'),
    count: bigint('count', { mode: 'number' }).default(0),
    createdAt: timestamp('created_at', { withTimezone: false })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: false })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => {
    return {
      idxTagsName: index('idx_tags_name').on(table.name),
      idxTagsType: index('idx_tags_type').on(table.type),
    };
  },
);

export type DBTag = typeof tags.$inferSelect;
export type InsertDBTag = typeof tags.$inferInsert;

export const tagSynonyms = pgTable('tag_synonyms', {
  source: text('source').primaryKey(),
  target: text('target').notNull(),
  createdAt: timestamp('created_at', { withTimezone: false })
    .default(sql`now()`)
    .notNull(),
});

export type DBTagSynonym = typeof tagSynonyms.$inferSelect;
export type InsertDBTagSynonym = typeof tagSynonyms.$inferInsert;

export const duplicateIgnores = pgTable(
  'duplicate_ignores',
  {
    video1: text('video1').notNull(),
    video2: text('video2').notNull(),
    createdAt: timestamp('created_at', { withTimezone: false })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.video1, t.video2] }),
  }),
);

export type DBDuplicateIgnore = typeof duplicateIgnores.$inferSelect;
export type InsertDBDuplicateIgnore = typeof duplicateIgnores.$inferInsert;
