let resolve = true
const server = {
  on: jest.fn(),
  listen: jest.fn(),
  close: jest.fn()
}

export const createServer = callback => {
  if (resolve) {
    callback(
      {
        url: 'https://127.0.0.1:4567/auth/callback?code=AUTH_CODE'
      },
      {
        writeHead: jest.fn(),
        end: jest.fn()
      }
    )
  }
  return server
}
createServer.__setResolve = () => {
  resolve = false
}
