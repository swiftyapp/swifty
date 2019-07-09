export default (state = { new: false, current: null, items: [] }, action) => {
  switch (action.type) {
    case 'NEW_ENTRY':
      return { ...state, new: true }
      break
    case 'SET_ENTRIES':
      return { ...state, items: action.entries }
      break
    case 'SET_CURRENT_ENTRY':
      return { ...state, current: findEntry(state, action.id), new: false }
      break
    case 'ENTRY_REMOVED':
      return { new: false, current: null, items: action.entries }
      break
    default:
      return state
  }
}

const findEntry = (state, id) => {
  return state.items.find(item => {
    if (item[id]) return item
  })
}
