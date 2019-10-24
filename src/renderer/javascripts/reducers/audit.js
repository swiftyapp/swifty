export default (state = null, action) => {
  switch (action.type) {
    case 'AUDIT_DONE':
      return action.data
    default:
      return state
  }
}
