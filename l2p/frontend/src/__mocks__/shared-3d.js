// Mock for shared-3d package in Jest tests
const noop = () => {}
const mockLighting = () => ({ lights: [], dispose: noop })

module.exports = {
  createArenaLighting: mockLighting,
  createQuizLighting: mockLighting,
  createLobbyLighting: mockLighting,
  ModelLoader: class MockModelLoader {
    async load() { return { scene: null, animations: [] } }
    dispose() {}
  },
  AnimationController: class MockAnimationController {
    play() {}
    stop() {}
    dispose() {}
  },
  createIsometricCamera: () => null,
  createPresentationCamera: () => null,
  createOrbitCamera: () => null,
  CharacterManager: class MockCharacterManager {},
}
