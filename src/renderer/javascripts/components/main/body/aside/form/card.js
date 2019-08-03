import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import Field from './field'
import SecureField from './secure'
import { saveEntry } from 'actions/entries'

const Card = ({ entry }) => {
  const dispatch = useDispatch()
  const [validate, setValidate] = useState(false)
  const [card, setCard] = useState(
    entry || {
      type: 'card',
      title: '',
      number: '',
      year: '',
      month: '',
      cvc: '',
      pin: '',
      name: ''
    }
  )
  
  const updateCard = event => {
    let obj = {}
    obj[event.target.name] = event.target.value
    setCard({ ...card, ...obj })
  }
  
  const reset = () => {
    if (entry) {
      dispatch({ type: 'SET_CURRENT_ENTRY', id: entry.id })
    } else {
      dispatch({ type: 'SET_NO_ENTRY' })
    }
  }
  
  const saveCard = () => {
    if (card.title && card.number && card.pin && card.cvc && card.month && card.year) {
      dispatch(saveEntry(card))
    } else {
      setValidate(true)
    }
  }

  return (
    <div className="aside">
      <Field
        name="Title"
        validate={validate}
        entry={card}
        onChange={updateCard}
      />
      <Field
        name="Number"
        validate={validate}
        entry={card}
        onChange={updateCard}
      />
      <Field
        name="Month"
        validate={validate}
        entry={card}
        onChange={updateCard}
      />
      <Field
        name="Year"
        validate={validate}
        entry={card}
        onChange={updateCard}
      />
      <Field
        name="CVC"
        validate={validate}
        entry={card}
        onChange={updateCard}
      />
      <SecureField
        name="Pin"
        validate={validate}
        entry={card}
        onChange={updateCard}
      />
      <Field
        name="Name"
        entry={card}
        onChange={updateCard}
      />
      <div className="actions">
        <span className="cancel" onClick={reset}>
          Cancel
        </span>
        <span className="button" onClick={saveCard}>
          Save
        </span>
      </div>
    </div>
  )
}

export default Card
