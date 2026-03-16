// Types
export type {
  PlayOptions,
  CharacterInstance,
  CharacterDefinition,
  AssetManifest,
  IsometricCameraOptions,
  PresentationCameraOptions,
  OrbitCameraOptions,
  LightingRig,
  LoadedModel,
} from './types.js';

// Model loader
export { ModelLoader } from './loader.js';
export type { ModelLoaderOptions } from './loader.js';

// Animation
export { AnimationController } from './animator.js';

// Cameras
export {
  createIsometricCamera,
  createPresentationCamera,
  createOrbitCamera,
} from './cameras.js';

// Lighting
export {
  createArenaLighting,
  createQuizLighting,
  createLobbyLighting,
} from './lighting.js';

// Characters
export { CharacterManager } from './characters.js';
export type { CharacterManagerOptions } from './characters.js';

// Viewer
export { createCharacterViewer } from './viewer.js';
export type { CharacterViewer } from './viewer.js';
