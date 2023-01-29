import classnames from 'classnames'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Tooltip from 'components/elements/tooltip'

import LoginIcon from 'login.svg'
import CardIcon from 'card.svg'
import NoteIcon from 'note.svg'
// import AuditIcon from 'information.svg'

const Switcher = () => {
  const { i18n } = window
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
      <Tooltip content={i18n('Logins')}>
        <div
          className={itemClassname('login')}
          onClick={() => switchScope('login')}
        >
          <LoginIcon with="28" height="28" />
        </div>
      </Tooltip>
      <Tooltip content={i18n('Secure Notes')}>
        <div
          className={itemClassname('note')}
          onClick={() => switchScope('note')}
        >
          <NoteIcon with="28" height="28" />
        </div>
      </Tooltip>
      <Tooltip content={i18n('Credit Cards')}>
        <div
          className={itemClassname('card')}
          onClick={() => switchScope('card')}
        >
          <CardIcon with="28" height="28" />
        </div>
      </Tooltip>
      {/* <Tooltip content={i18n('Password Audit')} className="bottom">
        <div
          className={itemClassname('audit', 'audit-button')}
          onClick={() => switchScope('audit')}
        >
          <AuditIcon with="30" height="30" />
        </div>
      </Tooltip> */}
    </div>
  )
}

export default Switcher
