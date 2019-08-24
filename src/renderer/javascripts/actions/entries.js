const {
  sendItemRemove,
  sendItemSave,
  onItemRemoved,
  onItemSaved,
  sendVaultSyncStart
} = window

export const deleteEntry = id => {
  return dispatch => {
    sendItemRemove(id)
    onItemRemoved((event, items) => {
      dispatch({ type: 'ENTRY_REMOVED', entries: items })
    })
    sendVaultSyncStart()
  }
}

export const saveEntry = credentials => {
  return dispatch => {
    sendItemSave(credentials)
    onItemSaved((event, data) => {
      dispatch({ type: 'SET_ENTRIES', ...data })
      dispatch({ type: 'ENTRY_SAVED', ...data })
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
