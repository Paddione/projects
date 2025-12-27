module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }],
    '@babel/preset-typescript',
    '@babel/preset-react'
  ],
  plugins: [
    // Plugin to transform import.meta expressions to work in Jest
    function importMetaPlugin() {
      return {
        visitor: {
          MetaProperty(path) {
            // Handle import.meta expressions
            if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
              // Replace with a mock object that has the expected properties
              path.replaceWithSourceString('({ env: process.env })');
            }
          },
          MemberExpression(path) {
            // Handle import.meta.env specifically
            if (
              path.node.object.type === 'MetaProperty' &&
              path.node.object.meta.name === 'import' &&
              path.node.object.property.name === 'meta' &&
              path.node.property.name === 'env'
            ) {
              // Replace import.meta.env with process.env
              path.replaceWithSourceString('process.env');
            }
          }
        }
      };
    }
  ]
};
