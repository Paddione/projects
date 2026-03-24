-- =============================================================================
-- VIDEOVAULT DATABASE - Complete Schema (Final State)
-- =============================================================================
-- Consolidated from 6 migration files.
-- Run against: videovault_db as videovault_user (or postgres superuser)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- =============================================================================
-- VIDEOS TABLE (with all extended columns from migrations 0002/0003)
-- =============================================================================
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR PRIMARY KEY,
    filename TEXT NOT NULL,
    display_name TEXT NOT NULL,
    path TEXT NOT NULL,
    size BIGINT NOT NULL,
    last_modified TIMESTAMP NOT NULL,
    metadata JSONB NOT NULL,
    categories JSONB NOT NULL,
    custom_categories JSONB NOT NULL,
    thumbnail JSONB,
    root_key TEXT,
    hash_fast TEXT,
    hash_perceptual TEXT,
    -- Extended metadata (migration 0002)
    bitrate BIGINT,
    codec VARCHAR(50),
    fps FLOAT,
    aspect_ratio VARCHAR(20),
    file_hash TEXT,
    metadata_extracted_at TIMESTAMP,
    processing_status VARCHAR(20) DEFAULT 'pending',
    -- Media type (migration 0003)
    media_type VARCHAR(20) DEFAULT 'video'
);

-- Video indexes
CREATE INDEX IF NOT EXISTS idx_videos_path ON videos(path);
CREATE INDEX IF NOT EXISTS idx_videos_last_modified ON videos(last_modified);
CREATE INDEX IF NOT EXISTS idx_videos_size ON videos(size);
CREATE INDEX IF NOT EXISTS idx_videos_path_modified ON videos(path, last_modified);
CREATE INDEX IF NOT EXISTS idx_videos_categories ON videos USING gin(categories);
CREATE INDEX IF NOT EXISTS idx_videos_custom_categories ON videos USING gin(custom_categories);
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_file_hash ON videos(file_hash);
CREATE INDEX IF NOT EXISTS idx_videos_processing_status ON videos(processing_status);
CREATE INDEX IF NOT EXISTS idx_videos_bitrate ON videos(bitrate);
CREATE INDEX IF NOT EXISTS idx_videos_fps ON videos(fps);
CREATE INDEX IF NOT EXISTS idx_videos_media_type ON videos(media_type);

-- =============================================================================
-- DIRECTORY ROOTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS directory_roots (
    root_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    directories JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- APP SETTINGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- FILTER PRESETS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS filter_presets (
    id VARCHAR PRIMARY KEY,
    name TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CLIENT ERRORS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_errors (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    error_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    message TEXT NOT NULL,
    code TEXT NOT NULL,
    severity TEXT NOT NULL,
    context JSONB DEFAULT NULL,
    user_agent TEXT,
    url TEXT,
    stack TEXT,
    request_id TEXT,
    ip TEXT
);

-- =============================================================================
-- THUMBNAILS TABLE (migration 0002)
-- =============================================================================
CREATE TABLE IF NOT EXISTS thumbnails (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    video_id VARCHAR NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('thumbnail', 'sprite')),
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    format VARCHAR(10) NOT NULL,
    file_size BIGINT NOT NULL,
    quality FLOAT,
    frame_count INTEGER,
    tile_layout VARCHAR(20),
    generated_by VARCHAR(20) NOT NULL,
    generation_params JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(video_id, type)
);

CREATE INDEX IF NOT EXISTS idx_thumbnails_video_id ON thumbnails(video_id);
CREATE INDEX IF NOT EXISTS idx_thumbnails_type ON thumbnails(type);
CREATE INDEX IF NOT EXISTS idx_thumbnails_created_at ON thumbnails(created_at);
CREATE INDEX IF NOT EXISTS idx_thumbnails_file_path ON thumbnails(file_path);

-- =============================================================================
-- SCAN STATE TABLE (migration 0002)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scan_state (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    root_key TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    last_modified TIMESTAMP NOT NULL,
    metadata_extracted BOOLEAN NOT NULL DEFAULT FALSE,
    thumbnail_generated BOOLEAN NOT NULL DEFAULT FALSE,
    sprite_generated BOOLEAN NOT NULL DEFAULT FALSE,
    last_scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(root_key, relative_path)
);

CREATE INDEX IF NOT EXISTS idx_scan_state_root_key ON scan_state(root_key);
CREATE INDEX IF NOT EXISTS idx_scan_state_last_modified ON scan_state(last_modified);
CREATE INDEX IF NOT EXISTS idx_scan_state_file_hash ON scan_state(file_hash);
CREATE INDEX IF NOT EXISTS idx_scan_state_pending_thumbnails ON scan_state(root_key) WHERE thumbnail_generated = FALSE;
CREATE INDEX IF NOT EXISTS idx_scan_state_pending_sprites ON scan_state(root_key) WHERE sprite_generated = FALSE;
CREATE INDEX IF NOT EXISTS idx_scan_state_pending_metadata ON scan_state(root_key) WHERE metadata_extracted = FALSE;

-- =============================================================================
-- PROCESSING JOBS TABLE (migration 0002)
-- =============================================================================
CREATE TABLE IF NOT EXISTS processing_jobs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type VARCHAR(50) NOT NULL,
    video_id VARCHAR REFERENCES videos(id) ON DELETE CASCADE,
    root_key TEXT,
    relative_path TEXT,
    priority INTEGER NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue_processing ON processing_jobs(status, priority, created_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_jobs_video_id ON processing_jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON processing_jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON processing_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);

-- =============================================================================
-- AUDIOBOOKS TABLE (migration 0003)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audiobooks (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    path TEXT NOT NULL,
    total_duration BIGINT NOT NULL,
    total_size BIGINT NOT NULL,
    cover_image TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    last_modified TIMESTAMP NOT NULL,
    root_key TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audiobooks_path ON audiobooks(path);
CREATE INDEX IF NOT EXISTS idx_audiobooks_author ON audiobooks(author);
CREATE INDEX IF NOT EXISTS idx_audiobooks_title ON audiobooks(title);
CREATE INDEX IF NOT EXISTS idx_audiobooks_last_modified ON audiobooks(last_modified);
CREATE INDEX IF NOT EXISTS idx_audiobooks_root_key ON audiobooks(root_key);

-- =============================================================================
-- AUDIOBOOK CHAPTERS TABLE (migration 0003)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audiobook_chapters (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    audiobook_id VARCHAR(255) NOT NULL REFERENCES audiobooks(id) ON DELETE CASCADE,
    index BIGINT NOT NULL,
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    duration BIGINT NOT NULL,
    start_time BIGINT NOT NULL,
    file_size BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chapters_audiobook_id ON audiobook_chapters(audiobook_id);
CREATE INDEX IF NOT EXISTS idx_chapters_index ON audiobook_chapters(index);

-- =============================================================================
-- EBOOKS TABLE (migration 0003)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ebooks (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    path TEXT NOT NULL,
    cover_image TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    last_modified TIMESTAMP NOT NULL,
    root_key TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebooks_path ON ebooks(path);
CREATE INDEX IF NOT EXISTS idx_ebooks_author ON ebooks(author);
CREATE INDEX IF NOT EXISTS idx_ebooks_title ON ebooks(title);
CREATE INDEX IF NOT EXISTS idx_ebooks_last_modified ON ebooks(last_modified);
CREATE INDEX IF NOT EXISTS idx_ebooks_root_key ON ebooks(root_key);

-- =============================================================================
-- EBOOK FILES TABLE (migration 0003)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ebook_files (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ebook_id VARCHAR(255) NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
    format VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    file_size BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_ebook_id ON ebook_files(ebook_id);
CREATE INDEX IF NOT EXISTS idx_files_format ON ebook_files(format);

-- =============================================================================
-- MEDIA PROGRESS TABLE (migration 0003)
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_progress (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    media_type VARCHAR(20) NOT NULL,
    media_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    chapter_index BIGINT,
    position BIGINT,
    format VARCHAR(10),
    location TEXT,
    watched_seconds BIGINT,
    percentage BIGINT DEFAULT 0,
    completed VARCHAR(5) NOT NULL DEFAULT 'false',
    last_accessed TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_media_type ON media_progress(media_type);
CREATE INDEX IF NOT EXISTS idx_progress_media_id ON media_progress(media_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON media_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_last_accessed ON media_progress(last_accessed);
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_unique ON media_progress(media_type, media_id, COALESCE(user_id, ''));

-- =============================================================================
-- TAGS TABLE (migration 0004)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tags (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    url TEXT,
    count BIGINT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(type);

-- =============================================================================
-- TAG SYNONYMS TABLE (migration 0004)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tag_synonyms (
    source TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- DUPLICATE IGNORES TABLE (migration 0004)
-- =============================================================================
CREATE TABLE IF NOT EXISTS duplicate_ignores (
    video1 TEXT NOT NULL,
    video2 TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (video1, video2)
);
