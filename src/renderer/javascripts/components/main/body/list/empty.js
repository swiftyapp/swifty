import React from 'react'

const Empty = () => {
  const { i18n } = window
  return (
    <div className="list">
      <div className="empty">{i18n('No Items')}</div>
    </div>
  )
}

export default Empty
