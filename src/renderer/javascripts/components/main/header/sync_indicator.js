import React from 'react'
import classnames from 'classnames'
import { useSelector } from 'react-redux'
import Gdrive from 'google-drive-color.svg'
import HardDrive from 'hard-drive.svg'
import Tick from 'success_tick@2x.png'
import Exclamation from 'warning_exclamation@2x.png'

const SyncIndicator = () => {
  const sync = useSelector(state => state.sync)

  const getIcon = () => {
    if (sync.enabled) {
      return <Gdrive width="18" height="18" />
    }
    return <HardDrive width="16" height="16" className="monochrome" />
  }

  const getStatusIcon = () => {
    if (sync.inProgress) return null
    if (sync.success) {
      return <img src={Tick} width="11" height="10" className="success-icon" />
    } else {
      return (
        <img src={Exclamation} width="4" height="10" className="error-icon" />
      )
    }
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
      {getStatusIcon()}
      {getIcon()}
    </div>
  )
}

export default SyncIndicator
