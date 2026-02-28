import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { readSidecar, writeSidecar, SIDECAR_FILENAME } from './sidecar';

describe('sidecar', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sidecar-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('readSidecar', () => {
    it('returns null when no metadata.json exists', async () => {
      const result = await readSidecar(tmpDir);
      expect(result).toBeNull();
    });

    it('reads and parses valid metadata.json', async () => {
      const data = { version: 1, categories: { age: ['teen'] }, customCategories: {} };
      await fs.writeFile(path.join(tmpDir, 'metadata.json'), JSON.stringify(data));
      const result = await readSidecar(tmpDir);
      expect(result).toEqual(data);
    });

    it('returns null for malformed JSON and logs warning', async () => {
      await fs.writeFile(path.join(tmpDir, 'metadata.json'), '{bad json');
      const result = await readSidecar(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe('writeSidecar', () => {
    it('writes metadata.json with formatted JSON', async () => {
      const data = { version: 1, id: 'abc', categories: { age: [] }, customCategories: {} };
      await writeSidecar(tmpDir, data);
      const content = await fs.readFile(path.join(tmpDir, 'metadata.json'), 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
      expect(content).toContain('\n');
    });

    it('does not throw when directory is missing', async () => {
      const missingDir = path.join(tmpDir, 'nonexistent');
      await expect(writeSidecar(missingDir, { version: 1 })).resolves.not.toThrow();
    });

    it('overwrites existing metadata.json', async () => {
      await fs.writeFile(path.join(tmpDir, 'metadata.json'), '{"old": true}');
      const newData = { version: 1, id: 'new' };
      await writeSidecar(tmpDir, newData);
      const content = JSON.parse(await fs.readFile(path.join(tmpDir, 'metadata.json'), 'utf-8'));
      expect(content).toEqual(newData);
    });
  });
});
