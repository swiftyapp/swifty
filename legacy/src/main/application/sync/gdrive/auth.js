import { shell } from 'electron'
import { google } from 'googleapis'
import log from 'electron-log'
import { loopback } from '../base/loopback'

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
    this.loadCredentials()
    this.auth.on('tokens', tokens => this._updateTokens(tokens))
  }

  isConfigured() {
    const result = this.readTokens()
    log.info('Google oAuth is configured')
    return result && result.access_token !== undefined
  }

  authenticate() {
    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [CONFIG.googleOauth.scope]
    })
    shell.openExternal(url)
    return loopback.startServer(PORT).then(code => {
      this.auth.getToken(code)
      loopback.stopServer()
    })
  }

  disconnect() {
    const { refresh_token } = this.readTokens()
    return this.writeTokens(Object.assign({}, { refresh_token }))
  }

  loadCredentials() {
    this.auth.setCredentials(this.readTokens())
  }

  _updateTokens(tokens) {
    const credentials = this.readTokens() || {}
    this.auth.setCredentials(tokens)
    this.writeTokens(Object.assign(credentials, tokens))
  }
}
