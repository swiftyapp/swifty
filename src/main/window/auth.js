import { BrowserWindow } from 'electron'

export default class AuthWindow extends BrowserWindow {
  constructor(url) {
    super({
      name: 'Connect Google Drive',
      width: 400,
      height: 520
    })
    this.url = url
  }

  authenticate() {
    return new Promise(resolve => {
      this.loadURL(this.url)
      this.webContents.on('did-navigate', (event, url) => {
        if (this.isAuthSuccess(url)) {
          return this.on('page-title-updated', (event, code) => {
            resolve(code)
          })
        }
      })
    })
  }

  isAuthSuccess(url) {
    return url.match(`${CONFIG.apiHost}/google_oauth2/callback`)
  }
}
