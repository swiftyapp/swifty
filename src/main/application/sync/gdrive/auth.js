import querystring from 'querystring'
import { createServer } from 'http'
import { parse } from 'url'
import { shell } from 'electron'
import { google } from 'googleapis'

const HOST = '127.0.0.1'
const PORT = '4567'
const PATH = '/auth/callback'
export default class Auth {
  constructor(readTokens, writeTokens) {
    this.readTokens = readTokens
    this.writeTokens = writeTokens
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `http://${HOST}:${PORT}${PATH}`
    )
    this.auth.setCredentials(this.readTokens())
    this.auth.on('tokens', tokens => this._updateTokens(tokens))
  }

  isConfigured() {
    const result = this.readTokens()
    return result && result.access_token !== undefined
  }

  authenticate() {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const { pathname, query } = parse(req.url)
        if (req.url && pathname === '/auth/callback') {
          const { code } = querystring.parse(query)
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('You can now close this Window')
          this.auth.getToken(code)
          server.close()
          resolve(code)
        }
      })
      server.on('error', error => reject(error))
      server.listen(4567)

      const url = this.auth.generateAuthUrl({
        access_type: 'offline',
        scope: [CONFIG.googleOauth.scope]
      })
      shell.openExternal(url)
    })
  }

  disconnect() {
    const { refresh_token } = this.readTokens()
    return this.writeTokens(Object.assign({}, { refresh_token }))
  }

  _updateTokens(tokens) {
    const credentials = this.readTokens() || {}
    this.auth.setCredentials(tokens)
    this.writeTokens(Object.assign(credentials, tokens))
  }
}
