import querystring from 'querystring'
import { createServer } from 'http'
import { parse } from 'url'

class Loopback {
  startServer(port) {
    if (this.server) this.stopServer()

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res, resolve)
      })
      this.server.on('error', error => reject(error))
      this.server.listen(port)
    })
  }

  stopServer() {
    this.server.close()
    this.server = null
  }

  handleRequest(req, res, resolve) {
    const { pathname, query } = parse(req.url)
    if (pathname === '/auth/callback') {
      const { code } = querystring.parse(query)

      this.respond(res)
      resolve(code)
    }
  }

  respond(res) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('You can now close this Window')
  }
}

const loopback = new Loopback()

export { loopback }
