export default (state = { scope: 'login', query: '', ids: [] }, action) => {
  switch (action.type) {
    case 'SET_FILTER_QUERY':
      return { ...state, query: action.query, ids: [] }
    case 'SET_FILTER_SCOPE':
      return { ...state, scope: action.scope, ids: [] }
    case 'SET_FILTER_IDS':
      return { ...state, ids: action.ids }
    default:
      return state
  }
}
