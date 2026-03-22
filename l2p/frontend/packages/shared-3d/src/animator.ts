import {
  AnimationMixer,
  AnimationClip,
  AnimationAction,
  LoopRepeat,
  LoopOnce,
  Object3D,
} from 'three';
import type { PlayOptions } from './types.js';

/**
 * Wraps Three.js AnimationMixer to provide a high-level API for animation
 * playback, cross-fading, and one-shot animations.
 */
export class AnimationController {
  private readonly mixer: AnimationMixer;
  private readonly clips: Map<string, AnimationClip> = new Map();
  private currentAction: AnimationAction | null = null;
  private _currentAnimation: string | null = null;

  constructor(root: Object3D) {
    this.mixer = new AnimationMixer(root);
  }

  /** Name of the currently playing animation, or null if none. */
  get currentAnimation(): string | null {
    return this._currentAnimation;
  }

  /** Exposes the underlying AnimationMixer for external consumers. */
  get animationMixer(): AnimationMixer { return this.mixer; }

  /** Names of all registered clips. */
  get clipNames(): string[] {
    return Array.from(this.clips.keys());
  }

  /** Register an AnimationClip for later playback. */
  addClip(clip: AnimationClip): void {
    this.clips.set(clip.name, clip);
  }

  /**
   * Play a named clip. Cross-fades from the current animation if one is
   * active and `crossFadeDuration` > 0.
   */
  play(name: string, options: PlayOptions = {}): void {
    const clip = this.clips.get(name);
    if (!clip) {
      console.warn(`[AnimationController] Unknown clip: "${name}"`);
      return;
    }

    const {
      loop = true,
      crossFadeDuration = 0,
      timeScale = 1,
      clampWhenFinished = false,
    } = options;

    const prevAction = this.currentAction;
    const newAction = this.mixer.clipAction(clip);

    newAction.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    newAction.clampWhenFinished = clampWhenFinished;
    newAction.setEffectiveTimeScale(timeScale);
    newAction.reset();

    if (prevAction && crossFadeDuration > 0) {
      newAction.crossFadeFrom(prevAction, crossFadeDuration, false);
    }

    newAction.play();
    this.currentAction = newAction;
    this._currentAnimation = name;
  }

  /**
   * Play a clip once, then automatically return to the previous animation
   * when the clip finishes.
   */
  playOnce(name: string, options: Omit<PlayOptions, 'loop'> = {}): void {
    const previousAnimation = this._currentAnimation;

    this.play(name, { ...options, loop: false, clampWhenFinished: true });

    const finishedHandler = (event: { action: AnimationAction }) => {
      if (event.action === this.currentAction) {
        this.mixer.removeEventListener('finished', finishedHandler);
        if (previousAnimation) {
          this.play(previousAnimation, { crossFadeDuration: options.crossFadeDuration });
        }
      }
    };

    this.mixer.addEventListener('finished', finishedHandler);
  }

  /** Stop all animations. */
  stop(): void {
    this.mixer.stopAllAction();
    this.currentAction = null;
    this._currentAnimation = null;
  }

  /** Advance the animation mixer by `delta` seconds. Call every frame. */
  update(delta: number): void {
    this.mixer.update(delta);
  }

  /** Stop all actions and remove event listeners. */
  dispose(): void {
    this.mixer.stopAllAction();
    this.currentAction = null;
    this._currentAnimation = null;
  }
}
