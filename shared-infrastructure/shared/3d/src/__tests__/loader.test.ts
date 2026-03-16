import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoadedModel } from '../types.js';

// ---- Mock three/addons before importing loader ----
const mockLoad = vi.fn();
const mockSetDecoderPath = vi.fn();

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    setDRACOLoader: vi.fn(),
    load: mockLoad,
  })),
}));

vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: vi.fn().mockImplementation(() => ({
    setDecoderPath: mockSetDecoderPath,
    dispose: vi.fn(),
  })),
}));

import { ModelLoader } from '../loader.js';

// Helper to resolve a mock load call with a fake model
function resolveLoad(model: LoadedModel) {
  const [, onLoad] = mockLoad.mock.calls[mockLoad.mock.calls.length - 1];
  onLoad({ scene: model.scene, animations: model.animations });
}

function resolveLoadAt(index: number, model: LoadedModel) {
  const [, onLoad] = mockLoad.mock.calls[index];
  onLoad({ scene: model.scene, animations: model.animations });
}

function rejectLoadAt(index: number, error: Error) {
  const [, , , onError] = mockLoad.mock.calls[index];
  onError(error);
}

function makeModel(id: string): LoadedModel {
  return {
    scene: { name: id, children: [], clone: vi.fn().mockReturnThis() } as any,
    animations: [],
  };
}

describe('ModelLoader', () => {
  let loader: ModelLoader;

  beforeEach(() => {
    mockLoad.mockClear();
    mockSetDecoderPath.mockClear();
    loader = new ModelLoader();
  });

  afterEach(() => {
    loader.dispose();
  });

  it('loads a model via GLTFLoader', async () => {
    const p = loader.load('model.glb');
    const model = makeModel('hero');
    resolveLoad(model);
    const result = await p;
    expect(result.scene).toBe(model.scene);
    expect(mockLoad).toHaveBeenCalledWith('model.glb', expect.any(Function), expect.any(Function), expect.any(Function));
  });

  it('caches loaded models — second call returns same object without re-loading', async () => {
    const p1 = loader.load('model.glb');
    resolveLoad(makeModel('hero'));
    const first = await p1;

    mockLoad.mockClear();
    const second = await loader.load('model.glb');

    expect(mockLoad).not.toHaveBeenCalled();
    expect(second).toBe(first);
  });

  it('deduplicates concurrent loads for the same URL', async () => {
    const p1 = loader.load('model.glb');
    const p2 = loader.load('model.glb');

    resolveLoad(makeModel('hero'));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
  });

  it('isCached returns false before load, true after', async () => {
    expect(loader.isCached('model.glb')).toBe(false);
    const p = loader.load('model.glb');
    resolveLoad(makeModel('x'));
    await p;
    expect(loader.isCached('model.glb')).toBe(true);
  });

  it('getCacheSize tracks entries', async () => {
    expect(loader.getCacheSize()).toBe(0);

    const p1 = loader.load('a.glb');
    resolveLoadAt(0, makeModel('a'));
    await p1;
    expect(loader.getCacheSize()).toBe(1);

    const p2 = loader.load('b.glb');
    resolveLoadAt(1, makeModel('b'));
    await p2;
    expect(loader.getCacheSize()).toBe(2);
  });

  it('LRU eviction removes the least-recently-used entry when maxCacheSize is exceeded', async () => {
    loader = new ModelLoader({ maxCacheSize: 2 });

    const pa = loader.load('a.glb');
    resolveLoadAt(0, makeModel('a'));
    await pa;

    const pb = loader.load('b.glb');
    resolveLoadAt(1, makeModel('b'));
    await pb;

    // Access 'a' again to make it more-recently-used than 'b'
    await loader.load('a.glb');

    // Load 'c' — should evict 'b' (least-recently-used)
    const pc = loader.load('c.glb');
    resolveLoadAt(2, makeModel('c'));
    await pc;

    expect(loader.isCached('a.glb')).toBe(true);
    expect(loader.isCached('b.glb')).toBe(false);
    expect(loader.isCached('c.glb')).toBe(true);
    expect(loader.getCacheSize()).toBe(2);
  });

  it('preload loads multiple URLs', async () => {
    const preloadPromise = loader.preload(['x.glb', 'y.glb']);
    resolveLoadAt(0, makeModel('x'));
    resolveLoadAt(1, makeModel('y'));
    await preloadPromise;
    expect(loader.isCached('x.glb')).toBe(true);
    expect(loader.isCached('y.glb')).toBe(true);
  });

  it('load rejects on error', async () => {
    const p = loader.load('bad.glb');
    rejectLoadAt(0, new Error('404'));
    await expect(p).rejects.toThrow('404');
  });

  it('dispose clears the cache', async () => {
    const p = loader.load('model.glb');
    resolveLoad(makeModel('hero'));
    await p;
    expect(loader.getCacheSize()).toBe(1);
    loader.dispose();
    expect(loader.getCacheSize()).toBe(0);
  });
});
