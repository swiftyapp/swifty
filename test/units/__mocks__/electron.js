module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app: {
    getPath: jest.fn(() => '/Applications'),
    getName: jest.fn(() => 'Swifty')
  },
  remote: jest.fn(),
  dialog: jest.fn()
}
