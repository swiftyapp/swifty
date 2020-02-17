import path from 'path'
import { google } from 'googleapis'
import AuthWindow from 'window/auth'
import Storage from 'application/storage'

const AUTH_RETRY_COUNT = 2

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
    this.auth.on('tokens', tokens => this.updateTokens(tokens))
  }

  buildAuth() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
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
      return this.retry(() => this.auth.getToken(code), AUTH_RETRY_COUNT)
    })
  }

  disconnect() {
    const tokens = this.readTokens()
    this.writeTokens(Object.assign({}, { refresh_token: tokens.refresh_token }))
  }

  updateTokens(tokens) {
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

  retry(fn, count) {
    return new Promise((resolve, reject) => {
      fn()
        .then(resolve)
        .catch(error => {
          if (count === 0) {
            reject(error)
            return
          }
          this.retry(fn, count - 1)
        })
    })
  }
}
