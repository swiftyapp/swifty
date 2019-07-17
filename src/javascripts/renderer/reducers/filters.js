export default (state = { query: '' }, action) => {
  switch (action.type) {
    case 'SET_FILTER_QUERY':
      return { query: action.query }
    default:
      return state
  }
}
