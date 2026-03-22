import {
  AmbientLight,
  DirectionalLight,
  SpotLight,
  Color,
  Object3D,
} from 'three';
import type { LightingRig } from './types.js';

/**
 * Creates a standard 3-light rig for arena / isometric views.
 *
 * - Ambient: soft fill
 * - Key (DirectionalLight): top-right, casts shadows
 * - Fill (DirectionalLight): bottom-left, no shadows
 */
export function createArenaLighting(): LightingRig {
  const ambient = new AmbientLight(0xffffff, 0.4);

  const key = new DirectionalLight(0xfff5e0, 1.2);
  key.position.set(10, 20, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 100;

  const fill = new DirectionalLight(0xe0f0ff, 0.4);
  fill.position.set(-10, 5, -10);

  const lights: Object3D[] = [ambient, key, fill];

  return {
    lights,
    dispose() {
      // Three.js lights don't have a dispose method, but we clear references
      lights.length = 0;
    },
  };
}

/**
 * 3-point lighting rig for quiz / character scenes.
 *
 * @param rimColor  Hex colour for the rim/back light (default #4466ff).
 */
export function createQuizLighting(rimColor: number | string = 0x4466ff): LightingRig {
  const ambient = new AmbientLight(0xffffff, 0.5);

  const key = new DirectionalLight(0xffffff, 1.0);
  key.position.set(5, 10, 5);

  const fill = new DirectionalLight(0xffffff, 0.3);
  fill.position.set(-5, 5, 5);

  const rim = new DirectionalLight(new Color(rimColor), 0.8);
  rim.position.set(0, 5, -10);

  const lights: Object3D[] = [ambient, key, fill, rim];

  return {
    lights,
    dispose() {
      lights.length = 0;
    },
  };
}

/**
 * Ambient + spotlight overhead for lobby / character-select screens.
 */
export function createLobbyLighting(): LightingRig {
  const ambient = new AmbientLight(0x111133, 0.8);

  const spot = new SpotLight(0xffffff, 2.0);
  spot.position.set(0, 10, 0);
  spot.angle = Math.PI / 6;
  spot.penumbra = 0.3;
  spot.castShadow = true;

  const fill = new DirectionalLight(0x8899ff, 0.3);
  fill.position.set(-5, 3, 5);

  const lights: Object3D[] = [ambient, spot, fill];

  return {
    lights,
    dispose() {
      lights.length = 0;
    },
  };
}
