import { OrthographicCamera, PerspectiveCamera, MathUtils } from 'three';
import type {
  IsometricCameraOptions,
  PresentationCameraOptions,
  OrbitCameraOptions,
} from './types.js';

/**
 * Create an OrthographicCamera configured for isometric top-down views.
 *
 * The camera is positioned at `pitch` and `yaw` angles (degrees) and
 * oriented to look at the world origin.
 */
export function createIsometricCamera(opts: IsometricCameraOptions = {}): OrthographicCamera {
  const {
    frustumSize = 10,
    aspect = 1,
    pitch = 45,
    yaw = 45,
    distance = 20,
    near = 0.1,
    far = 1000,
  } = opts;

  const halfH = frustumSize / 2;
  const halfW = halfH * aspect;

  const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);

  const pitchRad = MathUtils.degToRad(pitch);
  const yawRad = MathUtils.degToRad(yaw);

  camera.position.set(
    distance * Math.cos(pitchRad) * Math.sin(yawRad),
    distance * Math.sin(pitchRad),
    distance * Math.cos(pitchRad) * Math.cos(yawRad),
  );
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  return camera;
}

/**
 * Create a PerspectiveCamera suitable for character viewer / presentation panels.
 */
export function createPresentationCamera(opts: PresentationCameraOptions = {}): PerspectiveCamera {
  const {
    fov = 45,
    aspect = 1,
    near = 0.1,
    far = 100,
    distance = 3,
    height = 1.5,
  } = opts;

  const camera = new PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, height, distance);
  camera.lookAt(0, height / 2, 0);
  camera.updateProjectionMatrix();

  return camera;
}

/**
 * Create a PerspectiveCamera positioned along the Z-axis, suitable for use
 * with OrbitControls.
 */
export function createOrbitCamera(opts: OrbitCameraOptions = {}): PerspectiveCamera {
  const {
    fov = 45,
    aspect = 1,
    near = 0.1,
    far = 1000,
    distance = 5,
  } = opts;

  const camera = new PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  return camera;
}
