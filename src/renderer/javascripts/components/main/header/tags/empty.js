import React from 'react'

export default ({ tags }) => {
  if (tags.length !== 0) return null

  return (
    <div className="dropdown-empty">
      Start tagging your entries
      <br />
      to filter them by tags.
    </div>
  )
}
