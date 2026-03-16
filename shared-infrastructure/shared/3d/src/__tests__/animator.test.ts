import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Three.js ----
const mockMixerUpdate = vi.fn();
const mockActionPlay = vi.fn();
const mockActionStop = vi.fn();
const mockActionReset = vi.fn();
const mockCrossFadeFrom = vi.fn();
const mockActionSetLoop = vi.fn();
const mockActionSetEffectiveTimeScale = vi.fn();

function makeAction(clipName: string) {
  return {
    _clipName: clipName,
    play: mockActionPlay.mockReturnThis(),
    stop: mockActionStop.mockReturnThis(),
    reset: mockActionReset.mockReturnThis(),
    crossFadeFrom: mockCrossFadeFrom.mockReturnThis(),
    setLoop: mockActionSetLoop.mockReturnThis(),
    setEffectiveTimeScale: mockActionSetEffectiveTimeScale.mockReturnThis(),
    loop: 2201, // LoopRepeat
    clampWhenFinished: false,
    time: 0,
  };
}

const mockClipAction = vi.fn((clip: any) => makeAction(clip.name));
const mockMixerStopAll = vi.fn();

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    AnimationMixer: vi.fn().mockImplementation(() => ({
      update: mockMixerUpdate,
      clipAction: mockClipAction,
      stopAllAction: mockMixerStopAll,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    LoopRepeat: 2201,
    LoopOnce: 2202,
  };
});

import { AnimationController } from '../animator.js';
import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat } from 'three';

function makeClip(name: string): AnimationClip {
  return { name, tracks: [], duration: 1 } as any;
}

function makeRoot() {
  return {} as any;
}

describe('AnimationController', () => {
  let controller: AnimationController;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClipAction.mockImplementation((clip: any) => makeAction(clip.name));
    controller = new AnimationController(makeRoot());
    controller.addClip(makeClip('idle'));
    controller.addClip(makeClip('walk'));
    controller.addClip(makeClip('attack'));
  });

  it('has no currentAnimation initially', () => {
    expect(controller.currentAnimation).toBeNull();
  });

  it('clipNames returns all added clips', () => {
    expect(controller.clipNames).toEqual(expect.arrayContaining(['idle', 'walk', 'attack']));
    expect(controller.clipNames).toHaveLength(3);
  });

  it('play starts an animation', () => {
    controller.play('idle');
    expect(controller.currentAnimation).toBe('idle');
    expect(mockActionPlay).toHaveBeenCalled();
  });

  it('play with loop:false sets LoopOnce', () => {
    controller.play('walk', { loop: false });
    const action = mockClipAction.mock.results[mockClipAction.mock.calls.length - 1].value;
    expect(action.setLoop).toHaveBeenCalledWith(LoopOnce, 1);
  });

  it('play with loop:true (default) sets LoopRepeat', () => {
    controller.play('idle', { loop: true });
    const action = mockClipAction.mock.results[mockClipAction.mock.calls.length - 1].value;
    expect(action.setLoop).toHaveBeenCalledWith(LoopRepeat, Infinity);
  });

  it('play a second animation cross-fades from the first', () => {
    // Create distinct action mocks for each clip
    const idleAction = makeAction('idle');
    const walkAction = makeAction('walk');
    let callCount = 0;
    mockClipAction.mockImplementation(() => (callCount++ === 0 ? idleAction : walkAction));

    controller.play('idle');
    controller.play('walk', { crossFadeDuration: 0.3 });

    expect(walkAction.crossFadeFrom).toHaveBeenCalledWith(idleAction, 0.3, false);
  });

  it('stop calls stopAllAction on the mixer', () => {
    controller.play('idle');
    controller.stop();
    expect(mockMixerStopAll).toHaveBeenCalled();
    expect(controller.currentAnimation).toBeNull();
  });

  it('update calls mixer.update with delta', () => {
    controller.update(0.016);
    expect(mockMixerUpdate).toHaveBeenCalledWith(0.016);
  });

  it('playOnce plays a clip then returns to previous animation', () => {
    controller.play('idle');

    // Simulate 'finished' event being emitted by the mixer
    const mixerInstance = (AnimationMixer as any).mock.results[0].value;
    let finishedCallback: ((e: any) => void) | null = null;
    mixerInstance.addEventListener.mockImplementation((event: string, cb: any) => {
      if (event === 'finished') finishedCallback = cb;
    });

    controller.playOnce('attack');
    expect(controller.currentAnimation).toBe('attack');

    // Fire the finished event
    expect(finishedCallback).not.toBeNull();
    finishedCallback!({ action: mockClipAction.mock.results[mockClipAction.mock.calls.length - 1].value });

    // Should return to idle
    expect(controller.currentAnimation).toBe('idle');
  });

  it('addClip registers a new clip', () => {
    controller.addClip(makeClip('dance'));
    expect(controller.clipNames).toContain('dance');
  });

  it('dispose stops all actions', () => {
    controller.play('walk');
    controller.dispose();
    expect(mockMixerStopAll).toHaveBeenCalled();
  });
});
