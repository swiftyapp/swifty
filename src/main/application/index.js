import path from 'path'
import { app, systemPreferences } from 'electron'
import { Application } from 'nucleon'
import Window from '../window'
import Tray from '../tray'
import GDrive from './sync/gdrive'
import Vault from './vault'
import Auditor from './auditor'
import { onAuthStart, onAuthTouchId } from './events/auth'
import mainEvents from './events/main'
import setupEvents from './events/setup'
import { isWindows } from './helpers/os'

const INACTIVE_TIMEOUT = 60000

export default class Swifty extends Application {
  components() {
    return { Window }
  }

  call(events) {
    Object.values(events).forEach(event => event.call(this))
  }

  windowOptions() {
    return {
      titleBarStyle: 'hiddenInset',
      name: this.settings.name,
      width: this.settings.width,
      height: this.settings.height,
      devTools: this.settings.devTools,
      frame: !isWindows(),
      webPreferences: {
        preload: path.join(app.getAppPath(), 'preload', 'index.js')
      }
    }
  }

  onReady() {
    this.shouldShowAuth = false
    this.vault = new Vault()
    this.tray = new Tray(this)
    this.sync = new GDrive()
  }

  onWindowReady() {
    this.window.removeMenu()
    this.window.disableNavigation()
    this.setupWindowEvents()
    this.call(mainEvents)
    if (this.vault.isPristine()) return this.showSetup()
    return this.showAuth()
  }

  /**
   * Application Events
   */
  setupWindowEvents() {
    this.window.on('close', () => {
      this.shouldShowAuth = true
      clearTimeout(this.inactiveTimeout)
    })
    this.window.on('hide', () => {
      this.inactiveTimeout = setTimeout(() => {
        if (this.vault.cryptor) this.shouldShowAuth = true
      }, INACTIVE_TIMEOUT)
    })
    this.window.on('show', () => {
      clearTimeout(this.inactiveTimeout)
      if (this.shouldShowAuth) {
        this.showAuth()
        this.shouldShowAuth = false
      }
    })
  }

  /**
   * Authentication and Setup
   */

  showAuth() {
    this.window.webContents.send('auth', this.isTouchIdAvailable())
    if (this.isTouchIdAvailable()) {
      onAuthTouchId.call(this)
    }
    onAuthStart.call(this)
  }

  showSetup() {
    this.window.webContents.send('setup')
    this.call(setupEvents)
  }

  authSuccess() {
    this.window.enlarge()
    this.window.send('auth:success', {
      sync: this.sync.isConfigured(),
      data: this.vault.read(),
      platform: process.platform
    })
  }

  authFail() {
    this.window.send('auth:fail')
    this.showAuth()
  }

  getAudit() {
    const auditor = new Auditor(this.vault.read(), this.cryptor)
    auditor.getAudit().then(data => {
      this.window.send('audit:done', { data })
    })
  }

  pullVaultData() {
    this.window.send('vault:pull:started')
    return this.sync
      .pull()
      .then(() => {
        this.window.send('vault:pull:stopped', {
          success: true,
          data: this.vault.read()
        })
      })
      .catch(() => this.window.send('vault:pull:stopped', { success: false }))
  }

  isTouchIdAvailable() {
    return (
      this.cryptor &&
      process.platform === 'darwin' &&
      systemPreferences.canPromptTouchID()
    )
  }
}
