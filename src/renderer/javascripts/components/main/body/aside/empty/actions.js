import React, { useState } from 'react'
import classnames from 'classnames'
import { useSelector, useDispatch } from 'react-redux'

export default () => {
  const { i18n } = window
  const dispatch = useDispatch()
  const { isPristine } = useSelector(state => ({
    isPristine: state.entries.items.length === 0
  }))
  const [isLoading, setIsLoading] = useState(false)

  const onAddEntry = () => dispatch({ type: 'NEW_ENTRY' })

  const onImport = () => {
    setIsLoading(true)
    window.MessagesAPI.sendVaultImport()
  }

  if (!isPristine) return null

  return (
    <div className="actions">
      <div>
        <a href="#" onClick={onAddEntry}>
          {i18n('Create First Entry')}
        </a>
      </div>
      <div>{i18n('or')}</div>
      <div>
        <span
          className={classnames('button', { loading: isLoading })}
          onClick={onImport}
        >
          {i18n('Import from Gdrive')}
        </span>
      </div>
    </div>
  )
}
