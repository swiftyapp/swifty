module.exports = {
  modulePaths: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/test/setup/index.js'],
  moduleNameMapper: {
    electron: '<rootDir>/test/units/__mocks__/electron.js'
  }
}
