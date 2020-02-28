let windowClosed = false
let authDenied = false

const removeMenu = jest.fn()
const close = jest.fn()

const authenticate = jest.fn(() => {
  if (!windowClosed) {
    if (authDenied) {
      return Promise.resolve(null)
    }
    return Promise.resolve('CODE')
  }
  return Promise.reject()
})

const __setClose = () => {
  windowClosed = true
}
const __setAuthDenied = () => {
  authDenied = true
}

module.exports = jest.fn(() => {
  return {
    removeMenu: removeMenu,
    authenticate: authenticate,
    close: close,
    __setClose: __setClose,
    __setAuthDenied: __setAuthDenied
  }
})
