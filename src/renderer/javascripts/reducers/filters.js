export default (state = { scope: 'login', query: '', tags: [] }, action) => {
  switch (action.type) {
    case 'SET_FILTER_QUERY':
      return { ...state, query: action.query }
    case 'SET_FILTER_SCOPE':
      return { ...state, scope: action.scope }
    case 'SET_FILTER_TAG':
      return { ...state, tags: [action.tag] }
    case 'UNSET_FILTER_TAG':
      return { ...state, tags: [] }
    default:
      return state
  }
}
