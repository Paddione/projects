import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoadedModel } from '../types.js';

// Hoist mocks so they are defined before vi.mock factories run
const {
  mockLoad, mockPreload, mockIsCached, mockGetCacheSize, mockLoaderDispose,
  mockClone,
  mockPlay, mockStop, mockUpdate, mockAnimDispose, mockAddClip,
} = vi.hoisted(() => {
  const mockLoad = vi.fn();
  const mockPreload = vi.fn();
  const mockIsCached = vi.fn().mockReturnValue(false);
  const mockGetCacheSize = vi.fn().mockReturnValue(0);
  const mockLoaderDispose = vi.fn();

  const mockClone = vi.fn((obj: any) => ({
    ...obj,
    name: obj.name + '_clone',
    isObject3D: true,
  }));

  const mockPlay = vi.fn();
  const mockStop = vi.fn();
  const mockUpdate = vi.fn();
  const mockAnimDispose = vi.fn();
  const mockAddClip = vi.fn();

  return {
    mockLoad, mockPreload, mockIsCached, mockGetCacheSize, mockLoaderDispose,
    mockClone,
    mockPlay, mockStop, mockUpdate, mockAnimDispose, mockAddClip,
  };
});

// ---- Mock ModelLoader ----
vi.mock('../loader.js', () => ({
  ModelLoader: vi.fn().mockImplementation(() => ({
    load: mockLoad,
    preload: mockPreload,
    isCached: mockIsCached,
    getCacheSize: mockGetCacheSize,
    dispose: mockLoaderDispose,
  })),
}));

// ---- Mock SkeletonUtils — exports { clone, retarget, retargetClip } ----
vi.mock('three/addons/utils/SkeletonUtils.js', () => ({
  clone: mockClone,
}));

// ---- Mock AnimationController ----
vi.mock('../animator.js', () => ({
  AnimationController: vi.fn().mockImplementation(() => ({
    play: mockPlay,
    stop: mockStop,
    update: mockUpdate,
    dispose: mockAnimDispose,
    addClip: mockAddClip,
    currentAnimation: null,
    clipNames: [],
    animationMixer: { update: vi.fn() },
  })),
}));

// ---- Mock Three.js AnimationMixer for the stub model ----
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    AnimationMixer: vi.fn().mockImplementation(() => ({
      update: vi.fn(),
      clipAction: vi.fn(),
      stopAllAction: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  };
});

import { CharacterManager } from '../characters.js';

function makeModel(id: string): LoadedModel {
  return {
    scene: { name: id, isObject3D: true, clone: vi.fn().mockReturnThis() } as any,
    animations: [{ name: 'idle', tracks: [], duration: 1 } as any],
  };
}

describe('CharacterManager', () => {
  let manager: CharacterManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCached.mockReturnValue(false);
    manager = new CharacterManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('loads a model and returns a CharacterInstance', async () => {
    const model = makeModel('warrior');
    mockLoad.mockResolvedValueOnce(model);

    const instance = await manager.getCharacter('warrior', 'warrior.glb');

    expect(mockLoad).toHaveBeenCalledWith('warrior.glb');
    expect(instance).toBeDefined();
    expect(instance.id).toBe('warrior');
    expect(instance.mesh).toBeDefined();
  });

  it('clones the model for each instance (SkeletonUtils.clone)', async () => {
    const model = makeModel('mage');
    mockLoad.mockResolvedValue(model);

    await manager.getCharacter('mage', 'mage.glb');
    await manager.getCharacter('mage', 'mage.glb');

    // Two instances → two clones
    expect(mockClone).toHaveBeenCalledTimes(2);
  });

  it('caches the raw geometry — load is only called once per URL', async () => {
    const model = makeModel('tank');
    mockLoad.mockResolvedValue(model);

    await manager.getCharacter('tank', 'tank.glb');
    await manager.getCharacter('tank', 'tank.glb');

    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('creates an AnimationController per instance', async () => {
    const { AnimationController } = await import('../animator.js');
    const model = makeModel('rogue');
    mockLoad.mockResolvedValueOnce(model);

    await manager.getCharacter('rogue', 'rogue.glb');
    expect(AnimationController).toHaveBeenCalledTimes(1);
  });

  it('instance.playAnimation delegates to the AnimationController', async () => {
    const model = makeModel('zombie');
    mockLoad.mockResolvedValueOnce(model);

    const instance = await manager.getCharacter('zombie', 'zombie.glb');
    instance.playAnimation('walk');

    expect(mockPlay).toHaveBeenCalledWith('walk', undefined);
  });

  it('instance.stopAnimation delegates to the AnimationController', async () => {
    const model = makeModel('warrior');
    mockLoad.mockResolvedValueOnce(model);

    const instance = await manager.getCharacter('warrior', 'warrior.glb');
    instance.stopAnimation();

    expect(mockStop).toHaveBeenCalled();
  });

  it('instance.update calls AnimationController.update', async () => {
    const model = makeModel('warrior');
    mockLoad.mockResolvedValueOnce(model);

    const instance = await manager.getCharacter('warrior', 'warrior.glb');
    instance.update(0.016);

    expect(mockUpdate).toHaveBeenCalledWith(0.016);
  });

  it('releaseCharacter disposes the AnimationController', async () => {
    const model = makeModel('warrior');
    mockLoad.mockResolvedValueOnce(model);

    const instance = await manager.getCharacter('warrior', 'warrior.glb');
    manager.releaseCharacter(instance);

    expect(mockAnimDispose).toHaveBeenCalled();
  });

  it('preloadCharacter loads and caches the model', async () => {
    const model = makeModel('warrior');
    mockLoad.mockResolvedValueOnce(model);
    await manager.preloadCharacter('warrior', 'warrior.glb');
    expect(mockLoad).toHaveBeenCalledWith('warrior.glb');

    // Second call with the same id should NOT trigger another load
    mockLoad.mockClear();
    await manager.preloadCharacter('warrior', 'warrior.glb');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('dispose clears all instances and disposes the loader', async () => {
    const model = makeModel('warrior');
    mockLoad.mockResolvedValue(model);

    await manager.getCharacter('warrior', 'warrior.glb');
    await manager.getCharacter('warrior', 'warrior.glb');

    manager.dispose();

    expect(mockAnimDispose).toHaveBeenCalledTimes(2);
    expect(mockLoaderDispose).toHaveBeenCalled();
  });
});
