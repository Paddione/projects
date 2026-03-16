-- Migration 005: Platform tables for shared economy
-- Creates: profiles, inventory, loadouts, shop_catalog, transactions, match_escrow

-- ============================================================================
-- PROFILES TABLE - Player profile (character, gender, respect balance, XP)
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  VARCHAR(50),
  selected_character VARCHAR(50) NOT NULL DEFAULT 'student',
  selected_gender    VARCHAR(10) NOT NULL DEFAULT 'male',
  selected_power_up  VARCHAR(50),
  respect_balance    INTEGER NOT NULL DEFAULT 0,
  xp_total           INTEGER NOT NULL DEFAULT 0,
  level              INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INVENTORY TABLE - Owned items
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.inventory (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id            VARCHAR(100) NOT NULL,
  item_type          VARCHAR(20) NOT NULL,
  acquired_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acquisition_source VARCHAR(30) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON auth.inventory(user_id);
ALTER TABLE auth.inventory
  DROP CONSTRAINT IF EXISTS idx_inventory_user_item,
  ADD CONSTRAINT idx_inventory_user_item UNIQUE (user_id, item_id);

-- ============================================================================
-- LOADOUTS TABLE - Equipped items
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.loadouts (
  user_id           INTEGER PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  equipped_skin     VARCHAR(100),
  equipped_emote_1  VARCHAR(100),
  equipped_emote_2  VARCHAR(100),
  equipped_emote_3  VARCHAR(100),
  equipped_emote_4  VARCHAR(100),
  equipped_title    VARCHAR(100),
  equipped_border   VARCHAR(100),
  equipped_power_up VARCHAR(50),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SHOP CATALOG TABLE - Purchasable items
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.shop_catalog (
  item_id           VARCHAR(100) PRIMARY KEY,
  item_type         VARCHAR(20) NOT NULL,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  respect_cost      INTEGER NOT NULL,
  unlock_level      INTEGER,
  gender            VARCHAR(10),
  character         VARCHAR(50),
  preview_asset_url VARCHAR(255),
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- TRANSACTIONS TABLE - Economy audit log
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.transactions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  currency   VARCHAR(10) NOT NULL DEFAULT 'respect',
  amount     INTEGER NOT NULL,
  item_id    VARCHAR(100),
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON auth.transactions(user_id);

-- ============================================================================
-- MATCH ESCROW TABLE - Cross-game match betting
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.match_escrow (
  id           SERIAL PRIMARY KEY,
  token        VARCHAR(64) UNIQUE NOT NULL,
  player_ids   INTEGER[] NOT NULL,
  escrowed_xp  JSONB NOT NULL,
  match_config JSONB,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at   TIMESTAMPTZ
);

-- ============================================================================
-- CATALOG SEED DATA
-- Power-ups
-- ============================================================================
INSERT INTO auth.shop_catalog (item_id, item_type, name, description, respect_cost)
VALUES
  ('power_shield',   'power_up', 'Shield',    'Temporary damage shield',            0),
  ('power_haste',    'power_up', 'Haste',     'Move faster for a short duration',   500),
  ('power_vampiric', 'power_up', 'Vampiric',  'Regain HP on correct answers',       1000),
  ('power_lucky',    'power_up', 'Lucky',     'Increase chance of bonus rewards',   750),
  ('power_fury',     'power_up', 'Fury',      'Double damage on next strike',       1500),

  -- Emotes
  ('emote_wave',      'emote', 'Wave',      'Give a friendly wave',           0),
  ('emote_gg',        'emote', 'GG',        'Good game salute',               0),
  ('emote_thumbsup',  'emote', 'Thumbs Up', 'Show your approval',             250),
  ('emote_clap',      'emote', 'Clap',      'Applaud your opponent',          250),
  ('emote_shrug',     'emote', 'Shrug',     'Express indifference',           500),
  ('emote_taunt',     'emote', 'Taunt',     'Provoke your opponent',          500),
  ('emote_dance',     'emote', 'Dance',     'Bust a move',                    750),
  ('emote_facepalm',  'emote', 'Facepalm',  'Express disappointment',         750),

  -- Borders
  ('border_default',  'border', 'Default',  'The standard frame',             0),
  ('border_bronze',   'border', 'Bronze',   'A bronze-tier frame',            300),
  ('border_silver',   'border', 'Silver',   'A silver-tier frame',            750),
  ('border_gold',     'border', 'Gold',     'A gold-tier frame',              1500),
  ('border_diamond',  'border', 'Diamond',  'An elite diamond frame',         3000),
  ('border_flame',    'border', 'Flame',    'A fiery prestige frame',         2000)
ON CONFLICT (item_id) DO NOTHING;

-- ============================================================================
-- USER MIGRATION: seed profiles from existing auth.users
-- ============================================================================
INSERT INTO auth.profiles (user_id, display_name, selected_character, xp_total, level)
SELECT
  id,
  name,
  COALESCE(selected_character, 'student'),
  COALESCE(experience_points, 0),
  COALESCE(character_level, 1)
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- LOADOUT INIT: empty loadout for each user
-- ============================================================================
INSERT INTO auth.loadouts (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- FREE ITEMS GRANT: all users × all free catalog items
-- ============================================================================
INSERT INTO auth.inventory (user_id, item_id, item_type, acquisition_source)
SELECT
  u.id,
  c.item_id,
  c.item_type,
  'initial_grant'
FROM auth.users u
CROSS JOIN auth.shop_catalog c
WHERE c.respect_cost = 0
ON CONFLICT (user_id, item_id) DO NOTHING;
