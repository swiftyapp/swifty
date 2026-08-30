module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app: {
    getPath: jest.fn(() => '/tmp/Swifty'),
    getName: jest.fn(() => 'Swifty'),
    getVersion: jest.fn(() => '1.0.0')
  },
  remote: jest.fn(),
  dialog: jest.fn(),
  BrowserWindow: jest.fn(() => {
    return {
      send: jest.fn()
    }
  }),
  shell: {
    openExternal: jest.fn()
  }
}
