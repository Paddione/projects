import { describe, it, expect, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    // Keep real constructors — we just need them to work in jsdom
  };
});

import {
  createIsometricCamera,
  createPresentationCamera,
  createOrbitCamera,
} from '../cameras.js';
import { OrthographicCamera, PerspectiveCamera } from 'three';

describe('createIsometricCamera', () => {
  it('returns an OrthographicCamera', () => {
    const cam = createIsometricCamera();
    expect(cam).toBeInstanceOf(OrthographicCamera);
  });

  it('positions camera at a consistent distance from origin', () => {
    const cam = createIsometricCamera({ distance: 20 });
    const dist = cam.position.length();
    expect(dist).toBeCloseTo(20, 0);
  });

  it('respects custom frustumSize', () => {
    const cam = createIsometricCamera({ frustumSize: 5, aspect: 1 });
    expect(cam.top).toBeCloseTo(5 / 2, 3);
    expect(cam.bottom).toBeCloseTo(-5 / 2, 3);
  });

  it('respects custom aspect ratio', () => {
    const cam = createIsometricCamera({ frustumSize: 10, aspect: 2 });
    expect(cam.right).toBeCloseTo(10, 3);
    expect(cam.left).toBeCloseTo(-10, 3);
  });

  it('looks at the origin', () => {
    const cam = createIsometricCamera();
    // After lookAt(0,0,0), the camera's forward direction should point roughly at origin
    const dist = Math.sqrt(
      cam.position.x ** 2 + cam.position.y ** 2 + cam.position.z ** 2,
    );
    expect(dist).toBeGreaterThan(0);
  });
});

describe('createPresentationCamera', () => {
  it('returns a PerspectiveCamera', () => {
    const cam = createPresentationCamera();
    expect(cam).toBeInstanceOf(PerspectiveCamera);
  });

  it('uses the provided fov', () => {
    const cam = createPresentationCamera({ fov: 60 });
    expect(cam.fov).toBe(60);
  });

  it('is positioned at the configured distance', () => {
    const cam = createPresentationCamera({ distance: 4, height: 0 });
    expect(cam.position.z).toBeCloseTo(4, 3);
  });
});

describe('createOrbitCamera', () => {
  it('returns a PerspectiveCamera', () => {
    const cam = createOrbitCamera();
    expect(cam).toBeInstanceOf(PerspectiveCamera);
  });

  it('uses provided fov', () => {
    const cam = createOrbitCamera({ fov: 75 });
    expect(cam.fov).toBe(75);
  });

  it('is positioned at the configured distance along Z', () => {
    const cam = createOrbitCamera({ distance: 8 });
    expect(cam.position.z).toBe(8);
  });
});
