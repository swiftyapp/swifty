import path from 'path'
import { google } from 'googleapis'
import { DateTime } from 'luxon'
import AuthWindow from '../../../window/auth'
import Strg from './storage'
import Storage, { appDir } from '../../../storage'

export default class Client {
  constructor() {
    this.strg = new Strg()
    this.storage = new Storage()
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${CONFIG.apiHost}/google_oauth2/callback`
    )
    this.auth.on('tokens', tokens => this.storeTokens(tokens))
  }

  getAuth() {
    this.actualizeCredentials()
    return this.auth
  }

  isConfigured() {
    return (
      this.storage.read(path.join(appDir(), 'access_token.json')) &&
      this.storage.read(path.join(appDir(), 'refresh_token.json'))
    )
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
    this.storage.remove(path.join(appDir(), 'access_token.json'))
  }

  actualizeCredentials() {
    const accessToken = JSON.parse(
      this.storage.read(path.join(appDir(), 'access_token.json'))
    )
    const refreshToken = this.storage.read(
      path.join(appDir(), 'refresh_token.json')
    )

    if (this.isExpiredAccessToken(accessToken)) {
      this.auth.setCredentials({ refresh_token: refreshToken })
    } else {
      this.auth.setCredentials(accessToken)
    }
  }

  isExpiredAccessToken(accessToken) {
    const expiry = DateTime.fromMillis(accessToken.expiry_date)
    return expiry.diffNow('seconds').toObject().seconds < 60
  }

  storeTokens(tokens) {
    if (tokens.refresh_token) {
      this.strg.write('refresh_token', tokens.refresh_token)
      delete tokens.refresh_token
    }
    this.auth.setCredentials(tokens)
    this.strg.write('access_token', tokens)
  }

  authUrl() {
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [CONFIG.googleOauth.scope]
    })
  }
}
