import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import classnames from 'classnames'
import Search from 'search.svg'
import Gdrive from 'google-drive-color.svg'
import HardDrive from 'hard-drive.svg'

export default () => {
  const dispatch = useDispatch()
  const sync = useSelector(state => state.sync)

  const filterItems = event => {
    dispatch({ type: 'SET_FILTER_QUERY', query: event.target.value })
  }

  const getIcon = () => {
    if (sync.enabled) {
      return <Gdrive width="20" height="20" />
    }
    return <HardDrive width="18" height="18" className="monochrome" />
  }

  return (
    <div className="header">
      <div className="search">
        <Search width="16" height="16" />
        <input type="text" placeholder="Search" onChange={filterItems} />
      </div>
      <div
        className={classnames('sync-indicator', { loading: sync.inProgress })}
      >
        <div className="spinner" />
        {getIcon()}
      </div>
    </div>
  )
}
