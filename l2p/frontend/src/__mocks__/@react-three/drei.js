// Mock for @react-three/drei in Jest tests
const React = require('react')

const OrbitControls = () => null
const Environment = () => null
const useGLTF = () => ({ scene: null, animations: [] })
const Html = ({ children }) => React.createElement('div', null, children)

module.exports = {
  OrbitControls,
  Environment,
  useGLTF,
  Html,
}
