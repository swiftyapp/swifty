import classnames from 'classnames'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

import LoginIcon from 'login.svg'
import CardIcon from 'card.svg'
import NoteIcon from 'note.svg'
import AuditIcon from 'audit.svg'

const Switcher = () => {
  const dispatch = useDispatch()
  const { scope } = useSelector(state => state.filters)

  const switchScope = scope => {
    dispatch({ type: 'SET_FILTER_SCOPE', scope })
  }

  const itemClassname = (currentScope, className = '') => {
    return classnames(`item ${className}`, { current: scope === currentScope })
  }

  return (
    <div className="switcher">
      <div
        className={itemClassname('login')}
        title="Login"
        onClick={() => switchScope('login')}
      >
        <LoginIcon with="28" height="28" />
      </div>
      <div
        className={itemClassname('note')}
        title="Secure Note"
        onClick={() => switchScope('note')}
      >
        <NoteIcon with="28" height="28" />
      </div>
      <div
        className={itemClassname('card')}
        title="Credit Card"
        onClick={() => switchScope('card')}
      >
        <CardIcon with="28" height="28" />
      </div>
      <div
        className={itemClassname('audit', 'audit-button')}
        title="Password Audit"
        onClick={() => switchScope('audit')}
      >
        <AuditIcon with="28" height="28" />
      </div>
    </div>
  )
}

export default Switcher
