export default (state = { name: 'auth', touchID: false }, action) => {
  switch (action.type) {
    case 'FLOW_SETUP':
      return { ...state, name: 'setup' }
    case 'FLOW_AUTH':
      return { name: 'auth', touchID: action.touchID }
    case 'FLOW_MAIN':
      return { ...state, name: 'main' }
    default:
      return state
  }
}
