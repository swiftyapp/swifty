export default (state = { failure: false }, action) => {
  switch (action.type) {
    case 'AUTH_FAIL':
      return { failure: true }
      break
    case 'AUTH_SUCCESS', 'AUTH_CLEAR':
      return { failure: false }
      break
    default:
      return state
  }
}
