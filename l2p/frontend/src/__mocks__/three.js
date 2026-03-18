// Mock for 'three' in Jest tests
// Provides minimal stubs for Three.js classes used in 3D scene components
const noop = () => {}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this }
  clone() { return new Vector3(this.x, this.y, this.z) }
}

class Color {
  constructor() {}
  set() { return this }
}

class Object3D {
  constructor() { this.children = []; this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0 }; this.scale = new Vector3(1, 1, 1) }
  add() { return this }
  remove() { return this }
  traverse(fn) { fn(this) }
}

class Group extends Object3D {}
class Scene extends Object3D {}
class Mesh extends Object3D {}

class AnimationMixer {
  constructor() {}
  clipAction() { return { play: noop, stop: noop, reset: () => ({ play: noop }), setLoop: noop, clampWhenFinished: false } }
  update() {}
  addEventListener() {}
  removeEventListener() {}
}

class AnimationClip {
  static findByName() { return null }
}

const LoopRepeat = 2200
const LoopOnce = 2201

module.exports = {
  Vector3,
  Color,
  Object3D,
  Group,
  Scene,
  Mesh,
  AnimationMixer,
  AnimationClip,
  LoopRepeat,
  LoopOnce,
  MathUtils: { degToRad: (d) => d * Math.PI / 180 },
  SpotLight: class extends Object3D { constructor() { super(); this.target = new Object3D() } },
  AmbientLight: class extends Object3D {},
  DirectionalLight: class extends Object3D {},
  PointLight: class extends Object3D {},
}
