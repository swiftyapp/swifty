module.exports = {
  clearMocks: true,
  modulePaths: ['<rootDir>/src', '<rootDir>/src/main'],
  setupFiles: ['<rootDir>/test/setup/index.js'],
  moduleNameMapper: {
    electron: '<rootDir>/test/units/__mocks__/electron.js'
  }
}
