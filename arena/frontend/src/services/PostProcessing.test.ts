// arena/frontend/src/services/PostProcessing.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('three', async () => {
    const actual = await vi.importActual<typeof import('three')>('three');
    class MockWebGLRenderer {
        domElement = document.createElement('canvas');
        getSize = vi.fn(() => ({ x: 800, y: 600 }));
        setPixelRatio = vi.fn();
        setSize = vi.fn();
        render = vi.fn();
        dispose = vi.fn();
        shadowMap = { enabled: false };
    }
    return { ...actual, WebGLRenderer: MockWebGLRenderer };
});
vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
    EffectComposer: class {
        addPass = vi.fn();
        setSize = vi.fn();
        render = vi.fn();
        dispose = vi.fn();
        passes: any[] = [];
    },
}));
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({
    RenderPass: class { enabled = true; },
}));
vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => ({
    UnrealBloomPass: class {
        enabled = true;
        strength = 0;
        constructor(_res: any, s: number) { this.strength = s; }
    },
}));
vi.mock('three/addons/postprocessing/ShaderPass.js', () => ({
    ShaderPass: class {
        enabled = true;
        uniforms: Record<string, any> = {};
    },
}));

import { PostProcessing } from './PostProcessing';
import { Scene, WebGLRenderer, OrthographicCamera } from 'three';

describe('PostProcessing', () => {
    it('creates without throwing', () => {
        const renderer = new WebGLRenderer();
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        const pp = new PostProcessing(renderer, scene, camera);
        expect(pp).toBeDefined();
        pp.dispose();
        renderer.dispose();
    });

    it('render calls effectComposer.render', () => {
        const renderer = new WebGLRenderer();
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        const pp = new PostProcessing(renderer, scene, camera);
        pp.render();
        expect(pp['composer'].render).toHaveBeenCalled();
        pp.dispose();
        renderer.dispose();
    });
});
