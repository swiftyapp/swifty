export default (state = initialState(), action) => {
  switch (action.type) {
    case 'NEW_ENTRY':
      return { ...state, new: true, edit: false }
    case 'SET_NO_ENTRY':
      return { ...state, new: false, edit: false, current: null }
    case 'EDIT_ENTRY':
      return { ...state, edit: true, new: false }
    case 'SET_ENTRIES':
      return { ...state, items: decodeEntries(action.data) }
    case 'SET_CURRENT_ENTRY':
      return {
        ...state,
        current: findEntry(state, action.id),
        new: false,
        edit: false
      }
    case 'ENTRY_SAVED':
      return {
        ...state,
        edit: false,
        new: false,
        current: findEntry(state, action.currentId)
      }
    case 'ENTRY_REMOVED':
      return {
        new: false,
        edit: false,
        current: null,
        items: decodeEntries(action.data)
      }
    default:
      return state
  }
}

const decodeEntries = data => {
  return window.decryptData(data).entries
}

const findEntry = (state, id) => {
  return state.items.find(item => {
    if (item.id === id) return item
  })
}

const initialState = () => {
  return {
    new: false,
    edit: false,
    current: null,
    items: []
  }
}
