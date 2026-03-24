import type { Object3D, AnimationMixer, AnimationClip } from 'three';

// ---- Animation ----

export interface PlayOptions {
  loop?: boolean;
  crossFadeDuration?: number;
  timeScale?: number;
  clampWhenFinished?: boolean;
}

// ---- Character ----

export interface CharacterInstance {
  id: string;
  mesh: Object3D;
  mixer: AnimationMixer;
  playAnimation(name: string, options?: PlayOptions): void;
  stopAnimation(): void;
  update(delta: number): void;
  dispose(): void;
}

export interface CharacterDefinition {
  id: string;
  modelUrl: string;
  defaultAnimation?: string;
  scale?: number;
}

// ---- Asset Manifest ----

export interface AssetManifest {
  characters: CharacterDefinition[];
  version: string;
}

// ---- Camera ----

export interface IsometricCameraOptions {
  /** Orthographic frustum half-size (default 10) */
  frustumSize?: number;
  /** Viewport aspect ratio (default 1) */
  aspect?: number;
  /** Pitch angle in degrees (default 45) */
  pitch?: number;
  /** Yaw angle in degrees (default 45) */
  yaw?: number;
  /** Distance from origin (default 20) */
  distance?: number;
  near?: number;
  far?: number;
}

export interface PresentationCameraOptions {
  /** Vertical field-of-view in degrees (default 45) */
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
  /** Distance from origin (default 3) */
  distance?: number;
  /** Height offset (default 1.5) */
  height?: number;
}

export interface OrbitCameraOptions {
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
  /** Initial distance from origin (default 5) */
  distance?: number;
}

// ---- Lighting ----

export interface LightingRig {
  /** All lights as a group — add this to your scene */
  lights: Object3D[];
  dispose(): void;
}

// ---- Internal loader types ----

export interface LoadedModel {
  scene: Object3D;
  animations: AnimationClip[];
}
