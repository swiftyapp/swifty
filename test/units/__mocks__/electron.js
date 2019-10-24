module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app: {
    getPath: jest.fn(() => '/tmp'),
    getName: jest.fn(() => 'Swifty')
  },
  remote: jest.fn(),
  dialog: jest.fn(),
  BrowserWindow: jest.fn()
}
