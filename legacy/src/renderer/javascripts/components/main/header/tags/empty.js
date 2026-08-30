import React from 'react'

export default ({ tags }) => {
  const { i18n } = window
  if (tags.length !== 0) return null

  return <div className="dropdown-empty">{i18n('Start tagging')}</div>
}
