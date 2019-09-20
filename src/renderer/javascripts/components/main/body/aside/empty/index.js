import React from 'react'
import Actions from './actions'
import Audit from './audit'
import Security from 'security.svg'

export default () => {
  return (
    <div className="aside">
      <div className="empty">
        <Security width={200} height={200} />
        <h2>Swifty</h2>
        <p>Keep your passwords safe and organized</p>
        <br />
        <br />
        <br />
        <br />
        <Actions />
        <Audit />
      </div>
    </div>
  )
}
