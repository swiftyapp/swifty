import { trackVaultEvent } from 'analytics'

export const onItemAdd = function (_, data) {
  this.vaultManager.add(data, this.cryptor.secret)
  return hadndleDataChange()
}

export const onItemUpdate = function (_, data) {
  this.vaultManager.update(data.id, data, this.cryptor.secret)
  return hadndleDataChange()
}

export const onItemRemove = function (_, data) {
  this.vaultManager.remove(data.id, this.cryptor.secret)
  return hadndleDataChange()
}

const hadndleDataChange = function () {
  this.window.send('data:saved', { data: this.vaultManager.read() })
  trackVaultEvent('Saved')
  return this.getAudit()
}
