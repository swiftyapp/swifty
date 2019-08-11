import React from 'react'
import Search from './search'
import SyncIndicator from './sync_indicator'

export default () => {
  return (
    <div className="header">
      <Search />
      <SyncIndicator />
    </div>
  )
}
