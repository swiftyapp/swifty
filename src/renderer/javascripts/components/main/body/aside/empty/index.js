import React from 'react'
import Actions from './actions'
import Security from 'security.svg'

export default () => {
  const { i18n } = window
  return (
    <div className="aside">
      <div className="empty">
        <Security width={200} height={200} />
        <h2>Swifty</h2>
        <p>{i18n('Keep your passwords safe and organized')}</p>
        <Actions />
      </div>
    </div>
  )
}
