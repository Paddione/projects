// Mock for shared-3d package in vitest
const noop = () => {};
const noopAsync = () => Promise.resolve();

export class ModelLoader {
    load = () => Promise.resolve({ scene: {}, animations: [] });
    preload = noopAsync;
    dispose = noop;
}

export function createCharacterViewer() {
    return {
        mount: noop,
        loadCharacter: () => Promise.resolve(),
        playAnimation: noop,
        resize: noop,
        dispose: noop,
    };
}

export function createIsometricCamera() {
    return {
        position: { set: noop, x: 0, y: 0, z: 0 },
        lookAt: noop,
        updateProjectionMatrix: noop,
        left: 0, right: 0, top: 0, bottom: 0,
    };
}

export function createArenaLighting() {
    return { lights: [], dispose: noop };
}

export class CharacterManager {
    getCharacter = () => Promise.resolve({
        mesh: {
            position: { set: noop, x: 0, y: 0, z: 0 },
            rotation: { y: 0 },
            scale: { setScalar: noop },
        },
        playAnimation: noop,
        stopAnimation: noop,
        update: noop,
        dispose: noop,
    });
    releaseCharacter = noop;
    dispose = noop;
}
