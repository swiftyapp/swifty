const disconnect = jest.fn()

module.exports = jest.fn(() => {
  return {
    disconnect: disconnect
  }
})
