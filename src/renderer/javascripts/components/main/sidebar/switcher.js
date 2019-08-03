import classnames from 'classnames'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

import UserIcon from 'user.svg'
import CardIcon from 'credit-card.svg'
import NoteIcon from 'note.svg'

const Switcher = () => {
  const dispatch = useDispatch()
  const { scope } = useSelector(state => state.filters)

  const switchScope = scope => {
    dispatch({ type: 'SET_FILTER_SCOPE', scope })
  }

  const itemClassname = currentScope => {
    return classnames('item', { current: scope === currentScope })
  }

  return (
    <div className="switcher">
      <div
        className={itemClassname('login')}
        title="Login"
        onClick={() => switchScope('login')}
      >
        <UserIcon with="28" height="28" />
      </div>
      <div
        className={itemClassname('card')}
        title="Credit Card"
        onClick={() => switchScope('card')}
      >
        <CardIcon with="28" height="28" />
      </div>
      <div
        className={itemClassname('note')}
        title="Secure Note"
        onClick={() => switchScope('note')}
      >
        <NoteIcon with="28" height="28" />
      </div>
    </div>
  )
}

export default Switcher
