import React from 'react'
import Actions from './actions'
import Security from 'security.svg'

export default ({ isPristine }) => {
  return (
    <div className="aside">
      <div className="empty">
        <Security width={300} height={300} />
        <h2>Swifty</h2>
        <p>Keep your passwords safe and organized</p>
        <Actions isPristine={isPristine} />
      </div>
    </div>
  )
}
