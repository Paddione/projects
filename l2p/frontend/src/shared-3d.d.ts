declare module 'shared-3d' {
    import type { Object3D, OrthographicCamera } from 'three';

    export interface CharacterInstance {
        mesh: Object3D;
        playAnimation: (name: string, options?: { loop?: boolean }) => void;
        stopAnimation: () => void;
        update: (delta: number) => void;
        dispose: () => void;
    }

    export interface LightingRig {
        lights: Object3D[];
        dispose: () => void;
    }

    export interface CharacterViewer {
        mount: (el: HTMLElement) => void;
        loadCharacter: (config: { id: string; modelUrl: string; defaultAnimation?: string }) => Promise<void>;
        playAnimation: (name: string) => void;
        resize: () => void;
        dispose: () => void;
    }

    export class ModelLoader {
        load(url: string): Promise<{ scene: Object3D; animations: unknown[] }>;
        preload(url: string): Promise<void>;
        dispose(): void;
    }

    export class AnimationController {
        play(name: string): void;
        stop(): void;
        dispose(): void;
    }

    export function createCharacterViewer(loader?: ModelLoader): CharacterViewer;
    export function createIsometricCamera(config?: Record<string, unknown>): OrthographicCamera;
    export function createPresentationCamera(): OrthographicCamera;
    export function createOrbitCamera(): unknown;
    export function createArenaLighting(): LightingRig;
    export function createQuizLighting(ambientColor?: number | string): LightingRig;
    export function createLobbyLighting(ambientColor?: number | string): LightingRig;

    export class CharacterManager {
        getCharacter(id: string, modelUrl: string): Promise<CharacterInstance>;
        releaseCharacter(id: string): void;
        dispose(): void;
    }
}
