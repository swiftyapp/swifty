const isConfigured = jest.fn().mockReturnValue(true)

const setup = jest.fn(() => {
  return Promise.resolve()
})

const disconnect = jest.fn()
const _import = jest.fn()
const push = jest.fn(() => {
  return Promise.resolve()
})
const pull = jest.fn(() => {
  return Promise.resolve({ entries: [{ id: '1', password: 'password' }] })
})

module.exports = jest.fn(() => {
  return {
    isConfigured: isConfigured,
    setup: setup,
    disconnect: disconnect,
    import: _import,
    pull: pull,
    push: push
  }
})
