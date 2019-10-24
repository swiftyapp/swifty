import React from 'react'
import Search from './search'
import Controls from 'components/elements/controls'
import Tags from './tags'
import SyncIndicator from './sync_indicator'

export default () => {
  return (
    <div className="header">
      <Search />
      <Tags />
      <SyncIndicator />
      <Controls />
    </div>
  )
}
