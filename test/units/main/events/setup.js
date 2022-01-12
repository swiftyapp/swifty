import { BrowserWindow } from 'electron'
import VaultManager from 'application/vault_manager'
import Sync from 'application/sync'

const vaultManager = new VaultManager()
const sync = new Sync()
const window = new BrowserWindow()

vaultManager.read = jest.fn(() => {
  return '{"entries": [{"id": "2", "password": "qwerty.password", "type": "login"}], "updatedAt": "2030-06-01T10:00:00.000+02:00"}|password'
})

export const app = {
  vaultManager: vaultManager,
  window: window,
  sync: sync
}
