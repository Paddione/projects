// Mock for three/addons/* in Jest tests
const noop = () => {}

// GLTFLoader mock
class GLTFLoader {
  setDRACOLoader() { return this }
  load(_url, onLoad, _onProgress, _onError) {
    // Call onLoad with empty GLTF structure after a tick
    setTimeout(() => onLoad && onLoad({ scene: null, animations: [] }), 0)
  }
}

// DRACOLoader mock
class DRACOLoader {
  setDecoderPath() { return this }
  dispose() {}
}

// SkeletonUtils mock
const clone = (obj) => obj

module.exports = {
  GLTFLoader,
  DRACOLoader,
  clone,
  retarget: noop,
  retargetClip: noop,
}
