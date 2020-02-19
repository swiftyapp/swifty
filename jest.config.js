module.exports = {
  modulePaths: ['<rootDir>/src', '<rootDir>/src/main'],
  setupFiles: ['<rootDir>/test/setup/index.js'],
  moduleNameMapper: {
    electron: '<rootDir>/test/units/__mocks__/electron.js'
  }
}
