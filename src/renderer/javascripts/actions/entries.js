import shortid from 'shortid'
const { sendSaveData, onOnce, encryptData, sendVaultSyncStart } = window

export const deleteEntry = id => {
  return (dispatch, getState) => {
    const entries = getState().entries.items.filter(item => item.id !== id)
    sendSaveData(encryptData({ entries }))
    onOnce('data:saved', (event, data) => {
      dispatch({ type: 'ENTRY_REMOVED', ...data })
    })
    sendVaultSyncStart()
  }
}

export const saveEntry = credentials => {
  return (dispatch, getState) => {
    const [entries, item] = save(credentials, getState())
    sendSaveData(encryptData({ entries }))
    onOnce('data:saved', (event, data) => {
      dispatch({ type: 'SET_ENTRIES', ...data })
      dispatch({ type: 'ENTRY_SAVED', currentId: item.id, ...data })
    })
    sendVaultSyncStart()
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
  data.updated_at = date()
  entries[index] = data
  return [entries, data]
}

const create = (entries, data) => {
  const item = buildItem(data)
  entries.push(item)
  return [entries, item]
}

const date = () => {
  return new Date().toISOString()
}

const buildItem = data => {
  const now = date()
  return {
    id: shortid.generate(),
    ...data,
    created_at: now,
    updated_at: now
  }
}
