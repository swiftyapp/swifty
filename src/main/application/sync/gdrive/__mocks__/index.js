import { DateTime } from 'luxon'
const isConfigured = jest.fn().mockReturnValue(true)

const setup = jest.fn(() => {
  return Promise.resolve()
})

const disconnect = jest.fn()
const _import = jest.fn()
const push = jest.fn(() => {
  return Promise.resolve()
})
const fileExists = jest.fn(() => Promise.resolve(true))

const pull = jest.fn(() => {
  return Promise.resolve({
    entries: [{ id: '1', password: 'password' }],
    updatedAt: DateTime.local().toISO()
  })
})

module.exports = jest.fn(() => {
  return {
    isConfigured: isConfigured,
    setup: setup,
    fileExists: fileExists,
    disconnect: disconnect,
    import: _import,
    pull: pull,
    push: push
  }
})
