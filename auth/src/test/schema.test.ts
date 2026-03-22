import { describe, it, expect, vi } from 'vitest';

// Mock database module to avoid needing a real DB connection
vi.mock('../config/database.js', () => ({
  db: {},
  sql: {},
}));

const { profiles, inventory, loadouts, shopCatalog, transactions, matchEscrow } = await import('../db/schema.js');

describe('Platform Schema', () => {
  it('should export all platform tables', () => {
    expect(profiles).toBeDefined();
    expect(inventory).toBeDefined();
    expect(loadouts).toBeDefined();
    expect(shopCatalog).toBeDefined();
    expect(transactions).toBeDefined();
    expect(matchEscrow).toBeDefined();
  });
});
