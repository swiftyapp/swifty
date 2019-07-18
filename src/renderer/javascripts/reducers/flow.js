export default (state = 'auth', action) => {
  switch (action.type) {
    case 'FLOW_SETUP':
      return 'setup'
    case 'FLOW_AUTH':
      return 'auth'
    case 'FLOW_MAIN':
      return 'main'
    default:
      return state
  }
}
