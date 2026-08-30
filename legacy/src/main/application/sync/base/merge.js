import { merge, keyBy } from 'lodash'
import { DateTime } from 'luxon'

export const mergeData = (local, remote, cryptor) => {
  if (!remote) {
    local.updatedAt = now()
    return local
  }
  return cryptor.encryptData({
    entries: combine(group(local, cryptor), group(remote, cryptor)),
    updatedAt: now()
  })
}

const combine = (local, remote) => {
  return remote.timestamp > local.timestamp
    ? mergeInto(local, remote)
    : mergeInto(remote, local)
}

const mergeInto = (base, update) => {
  for (let key in base.data) {
    if (update.data[key]) {
      merge(base.data[key], update.data[key])
      delete update.data[key]
    } else {
      delete base.data[key]
    }
  }

  for (let key in update.data) {
    base.data[key] = update.data[key]
  }
  return Object.values(base.data)
}

const group = (encrypted, cryptor) => {
  const data = cryptor.decryptData(encrypted)
  return {
    data: keyBy(data.entries, 'id'),
    timestamp: DateTime.fromISO(data.updatedAt)
  }
}

const now = () => DateTime.local().toISO()
