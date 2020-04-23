import { BrowserWindow } from 'electron'
import Vault from 'application/vault'
import Sync from 'application/sync'

const vault = new Vault()
const sync = new Sync()
const window = new BrowserWindow()

vault.read = jest.fn(() => {
  return '{"entries": [{"id": "2", "password": "qwerty.password", "type": "login"}], "updatedAt": "2030-06-01T10:00:00.000+02:00"}|password'
})

export const app = {
  vault: vault,
  window: window,
  sync: sync
}
