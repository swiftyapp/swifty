import React from 'react'

export default ({ error }) => {
  if (!error) return null

  return <div className="error-message">{error}</div>
}
