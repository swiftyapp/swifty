import { combineReducers } from 'redux'
import flow from './flow'
import auth from './auth'
import entries from './entries'

export default combineReducers({
  flow,
  auth,
  entries
})
