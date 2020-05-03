module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app: {
    getPath: jest.fn(() => '/tmp/Swifty')
  },
  remote: jest.fn(),
  dialog: jest.fn(),
  BrowserWindow: jest.fn(() => {
    return {
      send: jest.fn()
    }
  })
}
