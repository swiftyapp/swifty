import { combineReducers } from 'redux'
import flow from './flow'
import auth from './auth'

export default combineReducers({
  flow,
  auth
})
