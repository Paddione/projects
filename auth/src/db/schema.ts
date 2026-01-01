import { pgSchema, serial, varchar, text, timestamp, boolean, integer, bigint, jsonb, unique, index } from 'drizzle-orm/pg-core';

// Create auth schema
export const authSchema = pgSchema('auth');

// ============================================================================
// USERS TABLE - Consolidated from all three projects
// ============================================================================
export const users = authSchema.table('users', {
  id: serial('id').primaryKey(),

  // Core authentication fields
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }), // NULL for OAuth-only accounts
  email_verified: boolean('email_verified').default(false).notNull(),

  // Profile fields
  name: varchar('name', { length: 255 }),
  avatar_url: varchar('avatar_url', { length: 500 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),

  // Role-based access control
  role: varchar('role', { length: 20 }).default('USER').notNull(), // 'USER' or 'ADMIN'

  // L2P-specific fields (character progression)
  selected_character: varchar('selected_character', { length: 50 }).default('student'),
  character_level: integer('character_level').default(1).notNull(),
  experience_points: integer('experience_points').default(0).notNull(),

  // User preferences (L2P pattern)
  preferences: jsonb('preferences').default({ language: 'en', theme: 'light' }),
  notification_settings: jsonb('notification_settings').default({ email: true, push: true }),

  // Email verification
  email_verification_token: varchar('email_verification_token', { length: 255 }),
  email_verification_expires: timestamp('email_verification_expires'),

  // Password reset
  password_reset_token: varchar('password_reset_token', { length: 255 }),
  password_reset_expires: timestamp('password_reset_expires'),

  // Security features
  failed_login_attempts: integer('failed_login_attempts').default(0).notNull(),
  last_failed_login: timestamp('last_failed_login'),
  account_locked_until: timestamp('account_locked_until'),

  // Account status
  is_active: boolean('is_active').default(true).notNull(),

  // Timestamps
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  last_login: timestamp('last_login'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
  roleIdx: index('users_role_idx').on(table.role),
  emailVerifiedIdx: index('users_email_verified_idx').on(table.email_verified),
}));

// ============================================================================
// OAUTH ACCOUNTS TABLE - Google OAuth integration
// ============================================================================
export const oauthAccounts = authSchema.table('oauth_accounts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // OAuth provider info
  provider: varchar('provider', { length: 50 }).notNull(), // 'google', etc.
  provider_account_id: varchar('provider_account_id', { length: 255 }).notNull(),

  // OAuth tokens
  access_token: text('access_token'),
  refresh_token: text('refresh_token'),
  expires_at: bigint('expires_at', { mode: 'number' }),
  token_type: varchar('token_type', { length: 50 }),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),

  // Timestamps
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('oauth_accounts_user_id_idx').on(table.user_id),
  providerUnique: unique('oauth_accounts_provider_unique').on(table.provider, table.provider_account_id),
}));

// ============================================================================
// SESSIONS TABLE - For session-based authentication
// ============================================================================
export const sessions = authSchema.table('sessions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  session_token: varchar('session_token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires').notNull(),

  // Device/client information
  ip_address: varchar('ip_address', { length: 45 }), // IPv6 max length
  user_agent: text('user_agent'),

  // Timestamps
  created_at: timestamp('created_at').defaultNow().notNull(),
  last_activity: timestamp('last_activity').defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('sessions_token_idx').on(table.session_token),
  userIdIdx: index('sessions_user_id_idx').on(table.user_id),
  expiresIdx: index('sessions_expires_idx').on(table.expires),
}));

// ============================================================================
// TOKEN BLACKLIST TABLE - For JWT logout
// ============================================================================
export const tokenBlacklist = authSchema.table('token_blacklist', {
  token: varchar('token', { length: 512 }).primaryKey(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  expiresIdx: index('token_blacklist_expires_idx').on(table.expires_at),
}));

// ============================================================================
// VERIFICATION TOKENS TABLE - For email verification
// ============================================================================
export const verificationTokens = authSchema.table('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(), // email
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires').notNull(),
}, (table) => ({
  identifierTokenPk: unique('verification_tokens_pk').on(table.identifier, table.token),
}));

// ============================================================================
// USER MIGRATION LOG TABLE - Audit trail for user migration
// ============================================================================
export const userMigrationLog = authSchema.table('user_migration_log', {
  id: serial('id').primaryKey(),
  merged_user_id: integer('merged_user_id').references(() => users.id),
  source_project: varchar('source_project', { length: 50 }).notNull(), // 'l2p', 'videovault', 'payment'
  source_user_id: varchar('source_user_id', { length: 255 }).notNull(),
  merge_strategy: varchar('merge_strategy', { length: 50 }).notNull(), // 'primary', 'merged', 'skipped'
  metadata: jsonb('metadata'),
  migrated_at: timestamp('migrated_at').defaultNow().notNull(),
});

// ============================================================================
// OAUTH CLIENTS TABLE - OAuth 2.0 client registrations (for L2P, etc.)
// ============================================================================
export const oauthClients = authSchema.table('oauth_clients', {
  id: serial('id').primaryKey(),
  client_id: varchar('client_id', { length: 255 }).notNull().unique(),
  client_secret: varchar('client_secret', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  redirect_uris: jsonb('redirect_uris').notNull().$type<string[]>(), // Array of allowed redirect URIs
  grant_types: jsonb('grant_types').default(['authorization_code', 'refresh_token']).$type<string[]>(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('oauth_clients_client_id_idx').on(table.client_id),
  activeIdx: index('oauth_clients_active_idx').on(table.is_active),
}));

// ============================================================================
// OAUTH AUTHORIZATION CODES TABLE - Short-lived codes for OAuth 2.0 flow
// ============================================================================
export const oauthAuthorizationCodes = authSchema.table('oauth_authorization_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  client_id: varchar('client_id', { length: 255 }).notNull().references(() => oauthClients.client_id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirect_uri: text('redirect_uri').notNull(),
  scope: varchar('scope', { length: 255 }).default('openid profile email'),
  expires_at: timestamp('expires_at').notNull(),
  used_at: timestamp('used_at'), // NULL if not used, prevents reuse
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  codeIdx: index('oauth_codes_code_idx').on(table.code),
  expiresIdx: index('oauth_codes_expires_idx').on(table.expires_at),
  clientIdIdx: index('oauth_codes_client_id_idx').on(table.client_id),
  userIdIdx: index('oauth_codes_user_id_idx').on(table.user_id),
}));

// ============================================================================
// APPS & ACCESS TABLES - App catalog and per-user access
// ============================================================================
export const apps = authSchema.table('apps', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  url: varchar('url', { length: 500 }).notNull(),
  metadata: jsonb('metadata').default({}),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyIdx: index('apps_key_idx').on(table.key),
  activeIdx: index('apps_active_idx').on(table.is_active),
}));

export const userAppAccess = authSchema.table('user_app_access', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  app_id: integer('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userAppUnique: unique('user_app_access_unique').on(table.user_id, table.app_id),
  userIdx: index('user_app_access_user_id_idx').on(table.user_id),
  appIdx: index('user_app_access_app_id_idx').on(table.app_id),
}));

// ============================================================================
// TYPE EXPORTS for TypeScript
// ============================================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type UserAppAccess = typeof userAppAccess.$inferSelect;
export type NewUserAppAccess = typeof userAppAccess.$inferInsert;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
export type OAuthAuthorizationCode = typeof oauthAuthorizationCodes.$inferSelect;
export type NewOAuthAuthorizationCode = typeof oauthAuthorizationCodes.$inferInsert;
