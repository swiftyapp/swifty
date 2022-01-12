import shortid from 'shortid'
import { DateTime } from 'luxon'

export const deleteEntry = id => {
  return (dispatch, getState) => {
    const item = getState().entries.items.find(item => item.id !== id)
    window.MessagesAPI.sendRemoveItem(item)
    window.MessagesAPI.onOnce('data:saved', (_, data) => {
      dispatch({ type: 'ENTRY_REMOVED', ...data })
    })
    window.MessagesAPI.sendVaultSyncStart()
  }
}

export const saveEntry = credentials => {
  return (dispatch, getState) => {
    const item = save(credentials, getState())
    window.MessagesAPI.onOnce('data:saved', (event, data) => {
      dispatch({ type: 'SET_ENTRIES', ...data })
      dispatch({ type: 'ENTRY_SAVED', currentId: item.id, ...data })
    })
    window.MessagesAPI.sendVaultSyncStart()
  }
}

export const isValid = entry => {
  switch (entry.type) {
    case 'login':
      return entry.title && entry.username && entry.password
    case 'card':
      return (
        entry.title &&
        entry.number &&
        entry.pin &&
        entry.cvc &&
        entry.month &&
        entry.year
      )
    case 'note':
      return entry.title && entry.note
    default:
      return false
  }
}

const save = (data, state) => {
  const entries = state.entries.items.slice(0)
  if (data.id && entries.find(e => e.id === data.id)) {
    return update(entries, data)
  }
  return create(entries, data)
}

const update = (entries, data) => {
  const index = entries.findIndex(item => item.id === data.id)
  data.updatedAt = date()
  entries[index] = data
  window.MessagesAPI.sendUpdateItem(data)
  return data
}

const create = (entries, data) => {
  const item = buildItem(data)
  entries.push(item)
  window.MessagesAPI.sendAddItem(item)
  return item
}

const date = () => {
  return DateTime.local().toISO()
}

const buildItem = data => {
  const now = date()
  return {
    id: shortid.generate(),
    ...data,
    createdAt: now,
    updatedAt: now
  }
}
