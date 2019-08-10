export default (
  state = { name: 'auth', touchID: false, sync: false },
  action
) => {
  switch (action.type) {
    case 'FLOW_SETUP':
      return { ...state, name: 'setup' }
    case 'FLOW_AUTH':
      return { name: 'auth', touchID: action.touchID }
    case 'FLOW_MAIN':
      return { ...state, name: 'main', sync: action.sync }
    case 'SYNC_DISCONNECTED':
      return { ...state, sync: false }
    case 'SYNC_CONNECTED':
      return { ...state, sync: true }
    default:
      return state
  }
}
