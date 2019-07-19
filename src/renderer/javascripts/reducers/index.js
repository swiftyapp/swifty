import { combineReducers } from 'redux'
import flow from './flow'
import entries from './entries'
import filters from './filters'

export default combineReducers({
  flow,
  entries,
  filters
})
