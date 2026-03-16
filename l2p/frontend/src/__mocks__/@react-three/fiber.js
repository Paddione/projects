// Mock for @react-three/fiber in Jest tests
const React = require('react')

const Canvas = ({ children }) => React.createElement('div', { 'data-testid': 'r3f-canvas' }, children)
const useFrame = () => {}
const useThree = () => ({ scene: { add: () => {}, remove: () => {} }, camera: {}, gl: {} })
const useLoader = () => ({ scene: null, animations: [] })

module.exports = {
  Canvas,
  useFrame,
  useThree,
  useLoader,
}
