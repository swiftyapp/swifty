import React from 'react'
import Actions from './actions'
import Security from 'security.svg'
import { useSelector } from 'react-redux'

export default ({ isPristine }) => {
  const audit = useSelector(state => state.audit)
  console.log(audit)

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
