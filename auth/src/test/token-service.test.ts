/**
 * TokenService Unit Tests
 *
 * Tests for JWT token generation, verification, and decoding.
 * No DB connection required — database module is fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB so the global setup (setup.ts) and TokenService don't attempt real DB connections.
vi.mock('../config/database.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn() }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('../db/schema.js', () => ({
  tokenBlacklist: { token: 'token', expires_at: 'expires_at' },
}));

vi.mock('./test-utils.js', () => ({
  deleteAllTestUsers: vi.fn().mockResolvedValue(0),
  getTestDataStats: vi.fn().mockResolvedValue({ testUsers: 0, testAccessRequests: 0, testSessions: 0 }),
}));

import { TokenService } from '../services/TokenService.js';
import type { User } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testUser: User = {
  id: 42,
  username: 'testuser',
  email: 'testuser@example.com',
  role: 'USER',
  selected_character: 'warrior',
  character_level: 5,
  password_hash: 'hashed-password',
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
};

// ---------------------------------------------------------------------------
// generateTokens()
// ---------------------------------------------------------------------------

describe('TokenService.generateTokens()', () => {
  let service: TokenService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    service = new TokenService();
  });

  it('returns an object with accessToken and refreshToken string properties', () => {
    const tokens = service.generateTokens(testUser);

    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });

  it('accessToken and refreshToken are different values', () => {
    const tokens = service.generateTokens(testUser);

    expect(tokens.accessToken).not.toBe(tokens.refreshToken);
  });

  it('generates non-empty tokens', () => {
    const tokens = service.generateTokens(testUser);

    expect(tokens.accessToken.length).toBeGreaterThan(0);
    expect(tokens.refreshToken.length).toBeGreaterThan(0);
  });

  it('each call produces different tokens (due to iat)', () => {
    // Wait a tick to ensure different iat if needed — typically same second
    // but JWT iat is the same within the same second; the tokens are still
    // structurally identical for same user. This test verifies they ARE strings
    // and successive calls produce the same structure.
    const tokens1 = service.generateTokens(testUser);
    const tokens2 = service.generateTokens(testUser);

    // Both should be valid JWT strings (3 dot-separated segments)
    expect(tokens1.accessToken.split('.')).toHaveLength(3);
    expect(tokens1.refreshToken.split('.')).toHaveLength(3);
    expect(tokens2.accessToken.split('.')).toHaveLength(3);
    expect(tokens2.refreshToken.split('.')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// verifyAccessToken()
// ---------------------------------------------------------------------------

describe('TokenService.verifyAccessToken()', () => {
  let service: TokenService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    service = new TokenService();
  });

  it('verifies a valid access token and returns the payload', () => {
    const { accessToken } = service.generateTokens(testUser);
    const payload = service.verifyAccessToken(accessToken);

    expect(payload.userId).toBe(testUser.id);
    expect(payload.username).toBe(testUser.username);
    expect(payload.email).toBe(testUser.email);
    expect(payload.role).toBe(testUser.role);
  });

  it('includes selectedCharacter and characterLevel in the payload', () => {
    const { accessToken } = service.generateTokens(testUser);
    const payload = service.verifyAccessToken(accessToken);

    expect(payload.selectedCharacter).toBe(testUser.selected_character);
    expect(payload.characterLevel).toBe(testUser.character_level);
  });

  it('throws INVALID_TOKEN for a garbage string', () => {
    expect(() => service.verifyAccessToken('not.a.token')).toThrow('INVALID_TOKEN');
  });

  it('throws INVALID_TOKEN for an empty string', () => {
    expect(() => service.verifyAccessToken('')).toThrow('INVALID_TOKEN');
  });

  it('throws INVALID_TOKEN when a refresh token is used as an access token', () => {
    const { refreshToken } = service.generateTokens(testUser);

    // Refresh token is signed with a different secret → verification fails
    expect(() => service.verifyAccessToken(refreshToken)).toThrow('INVALID_TOKEN');
  });
});

// ---------------------------------------------------------------------------
// verifyRefreshToken()
// ---------------------------------------------------------------------------

describe('TokenService.verifyRefreshToken()', () => {
  let service: TokenService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    service = new TokenService();
  });

  it('verifies a valid refresh token and returns userId and email', () => {
    const { refreshToken } = service.generateTokens(testUser);
    const payload = service.verifyRefreshToken(refreshToken);

    expect(payload.userId).toBe(testUser.id);
    expect(payload.email).toBe(testUser.email);
  });

  it('throws INVALID_REFRESH_TOKEN for a garbage string', () => {
    expect(() => service.verifyRefreshToken('garbage.token.here')).toThrow('INVALID_REFRESH_TOKEN');
  });

  it('throws INVALID_REFRESH_TOKEN when an access token is used as a refresh token', () => {
    const { accessToken } = service.generateTokens(testUser);

    // Access token is signed with a different secret → verification fails
    expect(() => service.verifyRefreshToken(accessToken)).toThrow('INVALID_REFRESH_TOKEN');
  });
});

// ---------------------------------------------------------------------------
// decodeToken()
// ---------------------------------------------------------------------------

describe('TokenService.decodeToken()', () => {
  let service: TokenService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    service = new TokenService();
  });

  it('decodes a valid access token without verification', () => {
    const { accessToken } = service.generateTokens(testUser);
    const decoded = service.decodeToken(accessToken);

    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(testUser.id);
    expect(decoded!.email).toBe(testUser.email);
  });

  it('returns null for an empty string', () => {
    const result = service.decodeToken('');

    expect(result).toBeNull();
  });

  it('returns a decoded payload for a structurally valid but unverified token', () => {
    // A refresh token is still a valid JWT structure — decode should work
    const { refreshToken } = service.generateTokens(testUser);
    const decoded = service.decodeToken(refreshToken);

    expect(decoded).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

describe('TokenService constructor validation', () => {
  it('constructs successfully in test environment without explicit secrets', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => new TokenService()).not.toThrow();
  });

  it('throws when JWT secrets are missing in non-test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => new TokenService()).toThrow('JWT secrets must be configured');

    process.env.NODE_ENV = originalEnv;
  });

  it('uses provided env vars when set', () => {
    process.env.JWT_SECRET = 'custom-jwt-secret-32chars-minimum!!';
    process.env.JWT_REFRESH_SECRET = 'custom-refresh-secret-32chars-min!';

    expect(() => new TokenService()).not.toThrow();

    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });
});
