import path from 'path'
import { app, systemPreferences } from 'electron'
import { Application } from 'nucleon'
import Window from '../window'
import Tray from '../tray'
import GDrive from './sync/gdrive'
import Vault from './vault'
import {
  onAuthStart,
  onAuthTouchId,
  onDataSave,
  onSetupDone,
  onBackupSave,
  onBackupSelect,
  onVaultSyncImport,
  onVaultSyncStart,
  onVaultSyncConnect,
  onVaultSyncDisconnect
} from './events'

const INACTIVE_TIMEOUT = 60000

export default class Swifty extends Application {
  components() {
    return { Window }
  }

  windowOptions() {
    return {
      titleBarStyle: 'hiddenInset',
      name: this.settings.name,
      width: this.settings.width,
      height: this.settings.height,
      devTools: this.settings.devTools,
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
    this.window.setMenu(null)
    this.window.disableNavigation()
    this.setupWindowEvents()
    this.subscribeForEvents()
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

  subscribeForEvents() {
    onDataSave(this.vault, this.window)
    onBackupSave(this.vault)
    onVaultSyncImport(this.vault, this.sync, () => this.showAuth())
    onVaultSyncConnect(this.sync, this.window)
    onVaultSyncDisconnect(this.sync, this.window)
    onVaultSyncStart(this.sync, this.window)
  }

  /**
   * Authentication and Setup
   */

  showAuth() {
    this.window.webContents.send('auth', this.isTouchIdAvailable())
    if (this.isTouchIdAvailable()) {
      onAuthTouchId(() => this.authSuccess(), () => this.authFail())
    }
    onAuthStart(
      this.vault,
      this.sync,
      () => this.authSuccess(),
      () => this.authFail()
    )
  }

  showSetup() {
    this.window.webContents.send('setup')
    onBackupSelect(this.vault, this.sync, this.window, () => this.authSuccess())
    onSetupDone(this.vault, this.sync, () => this.authSuccess())
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

  isTouchIdAvailable() {
    return (
      process.platform === 'darwin' &&
      this.sync.client &&
      this.sync.client.cryptor &&
      systemPreferences.canPromptTouchID()
    )
  }
}
