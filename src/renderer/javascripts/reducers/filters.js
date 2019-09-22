export default (state = { scope: 'login', query: '' }, action) => {
  switch (action.type) {
    case 'SET_FILTER_QUERY':
      return { ...state, query: action.query }
    case 'SET_FILTER_SCOPE':
      return { ...state, scope: action.scope }
    default:
      return state
  }
}
