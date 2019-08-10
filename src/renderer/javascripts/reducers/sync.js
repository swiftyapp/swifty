export default (
  state = { enabled: false, inProgress: false, success: true },
  action
) => {
  switch (action.type) {
    case 'SYNC_INIT':
      return { ...state, enabled: action.enabled }
    case 'SYNC_DISCONNECTED':
      return { ...state, enabled: false }
    case 'SYNC_CONNECTED':
      return { ...state, enabled: true }
    case 'SYNC_START':
      return { ...state, inProgress: true, success: true }
    case 'SYNC_STOP':
      return { ...state, inProgress: false, success: action.success }
    default:
      return state
  }
}
