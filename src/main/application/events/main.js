import { trackVaultEvent } from 'analytics'

export const onItemAdd = function (_, data) {
  this.vaultManager.add(data, this.cryptor.secret)
  this.window.send('vault:saved', { data: this.vaultManager.read() })
  trackVaultEvent('Item added')
  return this.getAudit()
}

export const onItemUpdate = function (_, data) {
  this.vaultManager.update(data.id, data, this.cryptor.secret)
  this.window.send('vault:saved', { data: this.vaultManager.read() })
  trackVaultEvent('Item updated')

  return this.getAudit()
}

export const onItemRemove = function (_, data) {
  this.vaultManager.remove(data.id, this.cryptor.secret)
  this.window.send('vault:saved', { data: this.vaultManager.read() })
  trackVaultEvent('Item removed')
}
