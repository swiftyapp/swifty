import path from 'path'
import { google } from 'googleapis'
import AuthWindow from '../../../../window/auth'
import Storage from '../../../storage'

export const credentialsFile = () => {
  if (!process.env.APP_ENV || process.env.APP_ENV === 'production') {
    return 'gdrive.swftx'
  }
  return `gdrive_${process.env.APP_ENV}.swftx`
}

export default class Client {
  constructor(cryptor) {
    this.cryptor = cryptor
    this.storage = new Storage(path.join('auth', credentialsFile()))
    this.auth = this.buildAuth()
    this.auth.on('tokens', tokens => this.updataTokens(tokens))
  }

  buildAuth() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${CONFIG.apiHost}/google_oauth2/callback`
    )
  }

  getAuth() {
    this.auth.setCredentials(this.readTokens())
    return this.auth
  }

  isConfigured() {
    const result = this.readTokens()
    return result && result.access_token !== undefined
  }

  authenticate() {
    this.authWindow = new AuthWindow(this.authUrl())
    this.authWindow.removeMenu()
    return this.authWindow.authenticate().then(code => {
      this.authWindow.close()
      return this.auth.getToken(code)
    })
  }

  disconnect() {
    const tokens = this.readTokens()
    this.writeTokens(Object.assign({}, { refresh_token: tokens.refresh_token }))
  }

  updataTokens(tokens) {
    const credentials = this.readTokens() || {}
    this.auth.setCredentials(tokens)
    this.writeTokens(Object.assign(credentials, tokens))
  }

  writeTokens(tokens) {
    return this.storage.write(this.cryptor.encrypt(JSON.stringify(tokens)))
  }

  readTokens() {
    try {
      return JSON.parse(this.cryptor.decrypt(this.storage.read()))
    } catch (e) {
      return null
    }
  }

  authUrl() {
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [CONFIG.googleOauth.scope]
    })
  }
}
