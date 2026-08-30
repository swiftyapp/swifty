export default (
  state = { enabled: false, inProgress: false, success: true, error: null },
  action
) => {
  switch (action.type) {
    case 'SYNC_INIT':
      return { ...state, enabled: action.enabled }
    case 'SYNC_DISCONNECTED':
      return { ...state, enabled: false }
    case 'SYNC_CONNECTED':
      return { ...state, enabled: true, success: true, error: null }
    case 'SYNC_START':
      return { ...state, inProgress: true, success: true, error: null }
    case 'SYNC_STOP':
      return {
        ...state,
        inProgress: false,
        success: action.success,
        error: action.error
      }
    default:
      return state
  }
}
