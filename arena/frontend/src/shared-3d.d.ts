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

    export class ModelLoader {
        load(url: string): Promise<{ scene: Object3D; animations: unknown[] }>;
        preload(url: string): Promise<void>;
        dispose(): void;
    }

    export function createCharacterViewer(): {
        mount: (el: HTMLElement) => void;
        loadCharacter: (url: string) => Promise<void>;
        playAnimation: (name: string) => void;
        resize: () => void;
        dispose: () => void;
    };

    export function createIsometricCamera(config?: {
        frustumSize?: number;
        aspect?: number;
        pitch?: number;
        yaw?: number;
        distance?: number;
    }): OrthographicCamera;

    export function createArenaLighting(): LightingRig;

    export class CharacterManager {
        getCharacter(id: string, modelUrl: string): Promise<CharacterInstance>;
        releaseCharacter(id: string): void;
        dispose(): void;
    }
}
