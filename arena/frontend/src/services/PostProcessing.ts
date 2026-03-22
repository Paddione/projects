import { WebGLRenderer, WebGLRenderTarget, Scene, Vector2 } from 'three';
import type { OrthographicCamera } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QualitySettings } from './QualitySettings';

const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.0 },
        darkness: { value: 1.2 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            gl_FragColor = vec4(mix(texel.rgb, vec3(1.0 - darkness), dot(uv, uv)), texel.a);
        }
    `,
};

const ChromaticShader = {
    uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.0 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        varying vec2 vUv;
        void main() {
            float r = texture2D(tDiffuse, vUv + vec2(amount, 0.0)).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - vec2(amount, 0.0)).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `,
};

export class PostProcessing {
    private readonly composer: EffectComposer;
    private readonly bloomPass: UnrealBloomPass;
    private readonly vignettePass: ShaderPass;
    private readonly chromaticPass: ShaderPass;

    constructor(renderer: WebGLRenderer, scene: Scene, camera: OrthographicCamera) {
        const q = QualitySettings.current;
        const size = renderer.getSize(new Vector2());
        const samples = q.tier === 'low' ? 0 : 4;

        const renderTarget = new WebGLRenderTarget(size.x, size.y, { samples });
        this.composer = new EffectComposer(renderer, renderTarget);
        this.composer.addPass(new RenderPass(scene, camera));

        this.bloomPass = new UnrealBloomPass(size, q.bloomStrength, 0.4, 0.6);
        this.bloomPass.enabled = q.bloomEnabled;
        this.composer.addPass(this.bloomPass);

        this.vignettePass = new ShaderPass(VignetteShader);
        this.vignettePass.enabled = q.vignetteEnabled;
        this.composer.addPass(this.vignettePass);

        this.chromaticPass = new ShaderPass(ChromaticShader);
        this.chromaticPass.enabled = false;
        this.composer.addPass(this.chromaticPass);

        // OutputPass handles linear → sRGB conversion (required since Three.js r154+)
        this.composer.addPass(new OutputPass());
    }

    render(): void {
        this.composer.render();
    }

    setChromatic(amount: number): void {
        if (!QualitySettings.current.chromaticEnabled) return;
        this.chromaticPass.enabled = amount > 0;
        this.chromaticPass.uniforms['amount'].value = amount;
    }

    applyQuality(): void {
        const q = QualitySettings.current;
        this.bloomPass.enabled = q.bloomEnabled;
        this.bloomPass.strength = q.bloomStrength;
        this.vignettePass.enabled = q.vignetteEnabled;
    }

    resize(width: number, height: number): void {
        this.composer.setSize(width, height);
    }

    dispose(): void {
        this.composer.dispose();
    }
}
