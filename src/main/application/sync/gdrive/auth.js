import { google } from 'googleapis'
import AuthWindow from 'window/authentication'

export default class Auth {
  constructor(readTokens, writeTokens) {
    this.readTokens = readTokens
    this.writeTokens = writeTokens
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    )
    this.auth.setCredentials(this.readTokens())
    this.auth.on('tokens', tokens => this._updateTokens(tokens))
  }

  isConfigured() {
    const result = this.readTokens()
    return result && result.access_token !== undefined
  }

  authenticate() {
    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [CONFIG.googleOauth.scope]
    })
    this.authWindow = new AuthWindow(url)
    this.authWindow.removeMenu()
    return this.authWindow.authenticate().then(code => {
      this.authWindow.close()
      if (code) return this.auth.getToken(code)
      return null
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
