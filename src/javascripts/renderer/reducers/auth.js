export default (state = { failure: false }, action) => {
  switch (action.type) {
    case 'AUTH_FAIL':
      return { failure: true }
    case 'AUTH_SUCCESS', 'AUTH_CLEAR':
      return { failure: false }
    default:
      return state
  }
}
