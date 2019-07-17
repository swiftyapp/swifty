export default (state = initialState(), action) => {
  switch (action.type) {
    case 'NEW_ENTRY':
      return { ...state, new: true, edit: false }
    case 'EDIT_ENTRY':
      return { ...state, edit: true, new: false }
    case 'SET_ENTRIES':
      return { ...state, items: action.entries }
    case 'SET_CURRENT_ENTRY':
      return { ...state, current: findEntry(state, action.id), new: false, edit: false }
    case 'ENTRY_SAVED':
      return { ...state, edit: false, new: false, current: findEntry(state, action.entry.id) }
    case 'ENTRY_REMOVED':
      return { new: false, edit: false, current: null, items: action.entries }
    default:
      return state
  }
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
