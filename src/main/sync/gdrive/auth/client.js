import { google } from 'googleapis'
import { DateTime } from 'luxon'
import AuthWindow from '../../../window/auth'
import Storage from './storage'

export default class Client {
  constructor() {
    this.storage = new Storage()
    this.refreshToken = this.storage.read('refresh_token')
    this.accessToken = this.storage.read('access_token')
    if (this.refreshToken) {
      this.setupAuth()
      this.setupCredentials()
    }
  }

  setupAuth() {
    this.auth = new google.auth.OAuth2(
      CONFIG.googleOauth.clientId,
      CONFIG.googleOauth.clientSecret,
      `${CONFIG.apiHost}/google_oauth2/callback`
    )
    this.auth.on('tokens', tokens => this.storeTokens(tokens))
  }

  setupCredentials() {
    if (this.isExpiredAccessToken()) {
      this.auth.setCredentials({ refresh_token: this.refreshToken })
    } else {
      this.auth.setCredentials(this.accessToken)
    }
  }

  isExpiredAccessToken() {
    const expiry = DateTime.fromMillis(this.accessToken.expiry_date)
    return expiry.diffNow('seconds').toObject().seconds < 60
  }

  storeTokens(tokens) {
    if (tokens.refresh_token) {
      this.refreshToken = tokens.refresh_token
      delete tokens.refresh_token
      this.storage.write('refresh_token', this.refreshToken)
    }
    this.auth.setCredentials(tokens)
    this.storage.write('access_token', tokens)
  }

  authenticate() {
    this.authWindow = new AuthWindow(this.authUrl())
    return this.authWindow.authenticate().then(code => {
      this.authWindow.close()
      return this.auth.getToken(code)
    })
  }

  authUrl() {
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [CONFIG.googleOauth.scope]
    })
  }
}
