import { combineReducers } from 'redux'
import flow from './flow'
import sync from './sync'
import entries from './entries'
import audit from './audit'
import filters from './filters'

export default combineReducers({
  flow,
  sync,
  entries,
  audit,
  filters
})
