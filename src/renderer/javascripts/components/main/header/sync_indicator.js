import React from 'react'
import classnames from 'classnames'
import { useSelector } from 'react-redux'
import Gdrive from 'google-drive-color.svg'
import HardDrive from 'hard-drive.svg'

const SyncIndicator = () => {
  const sync = useSelector(state => state.sync)

  const getIcon = () => {
    if (sync.enabled) {
      return <Gdrive width="20" height="20" />
    }
    return <HardDrive width="18" height="18" className="monochrome" />
  }

  return (
    <div
      className={classnames('sync-indicator', {
        static: !sync.enabled,
        loading: sync.inProgress,
        success: sync.enabled && sync.success,
        failure: sync.enabled && !sync.success
      })}
    >
      <div className="spinner" />
      {getIcon()}
    </div>
  )
}

export default SyncIndicator
