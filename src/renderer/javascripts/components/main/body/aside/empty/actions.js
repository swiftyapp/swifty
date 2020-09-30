import React, { useState } from 'react'
import classnames from 'classnames'
import { useSelector, useDispatch } from 'react-redux'

export default () => {
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
          Create First Entry
        </a>
      </div>
      <div>or</div>
      <div>
        <span
          className={classnames('button', { loading: isLoading })}
          onClick={onImport}
        >
          Import from Gdrive
        </span>
      </div>
    </div>
  )
}
