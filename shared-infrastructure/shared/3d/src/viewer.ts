import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Clock,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { ModelLoader } from './loader.js';
import { AnimationController } from './animator.js';
import { createQuizLighting } from './lighting.js';
import type { CharacterDefinition } from './types.js';

/**
 * Public interface for the CharacterViewer.
 */
export interface CharacterViewer {
  /** Mount the Three.js canvas into the given container element. */
  mount(container: HTMLElement): void;
  /** Load and display a character model from a CharacterDefinition. */
  loadCharacter(def: CharacterDefinition): Promise<void>;
  /** Play a named animation clip (one-shot via AnimationController.playOnce). */
  playAnimation(name: string): void;
  /** Update renderer and camera aspect ratio after container resize. */
  resize(): void;
  /** Stop animation loop and release all Three.js resources. */
  dispose(): void;
}

/**
 * Create a CharacterViewer that uses a shared ModelLoader for GLB loading,
 * OrbitControls with auto-rotate, and quiz-style 3-point lighting.
 *
 * @param loader  A ModelLoader instance (can be shared with other viewers).
 */
export function createCharacterViewer(loader: ModelLoader): CharacterViewer {
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 0.75, 0);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  renderer.setClearColor(0x000000, 0);

  // Lighting
  const lighting = createQuizLighting();
  for (const light of lighting.lights) {
    scene.add(light);
  }

  let controls: OrbitControls | null = null;
  let animController: AnimationController | null = null;
  let rafId: number | null = null;
  const clock = new Clock();

  // Current character mesh (so we can remove it before loading a new one)
  let currentMesh: ReturnType<typeof skeletonClone> | null = null;

  function startLoop(): void {
    if (rafId !== null) return;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      controls?.update();
      animController?.update(delta);
      renderer.render(scene, camera);
    };
    animate();
  }

  function stopLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return {
    mount(container: HTMLElement): void {
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w || 300, h || 300);
      camera.aspect = (w || 300) / (h || 300);
      camera.updateProjectionMatrix();

      container.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.5;
      controls.enablePan = false;
      controls.minDistance = 1.5;
      controls.maxDistance = 6;
      controls.target.set(0, 0.75, 0);
      controls.update();

      startLoop();
    },

    async loadCharacter(def: CharacterDefinition): Promise<void> {
      // Remove previous mesh
      if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh = null;
      }
      animController?.dispose();
      animController = null;

      const loaded = await loader.load(def.modelUrl);
      const mesh = skeletonClone(loaded.scene);

      if (def.scale != null) {
        mesh.scale.setScalar(def.scale);
      }

      animController = new AnimationController(mesh);
      for (const clip of loaded.animations) {
        animController.addClip(clip);
      }

      if (def.defaultAnimation) {
        animController.play(def.defaultAnimation);
      }

      scene.add(mesh);
      currentMesh = mesh;
    },

    playAnimation(name: string): void {
      animController?.playOnce(name);
    },

    resize(): void {
      const canvas = renderer.domElement;
      const container = canvas.parentElement;
      if (!container) return;
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    dispose(): void {
      stopLoop();
      controls?.dispose();
      animController?.dispose();
      lighting.dispose();
      if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh = null;
      }
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
