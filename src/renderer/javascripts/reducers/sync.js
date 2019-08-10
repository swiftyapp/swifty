export default (state = { enabled: false, inProgress: false }, action) => {
  switch (action.type) {
    case 'SYNC_INIT':
      return { ...state, enabled: action.enabled }
    case 'SYNC_DISCONNECTED':
      return { ...state, enabled: false }
    case 'SYNC_CONNECTED':
      return { ...state, enabled: true }
    case 'SYNC_START':
      return { ...state, inProgress: true }
    case 'SYNC_STOP':
      return { ...state, inProgress: false }
    default:
      return state
  }
}
