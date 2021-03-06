import React, { useState } from 'react'
import { DateTime } from 'luxon'
import { useSelector, useDispatch } from 'react-redux'

import Login from './login'
import Card from './card'
import Note from './note'

import { saveEntry, isValid } from 'actions/entries'
import entries from 'defaults/entries'

const Form = ({ entry }) => {
  const { i18n } = window
  const dispatch = useDispatch()
  const { scope } = useSelector(state => state.filters)

  const [validate, setValidate] = useState(false)
  const [model, setModel] = useState(
    window.CryptorAPI.expose(entry) || entries[scope]
  )

  const onCancel = () => {
    if (model.id) {
      dispatch({ type: 'SET_CURRENT_ENTRY', id: model.id })
    } else {
      dispatch({ type: 'SET_NO_ENTRY' })
    }
  }

  const onSave = () => {
    if (isValid(model)) {
      dispatch(saveEntry(window.CryptorAPI.obscure(model)))
    } else {
      setValidate(true)
    }
  }

  const onTagsChange = tags => {
    onChange({ target: { name: 'tags', value: tags } })
  }

  const onChange = event => {
    let obj = {}
    const {
      target: { name, value }
    } = event
    if (name === 'password') {
      obj['password_updated_at'] = DateTime.local().toISO()
    }
    obj[name] = value
    setModel({ ...model, ...obj })
  }

  const renderFields = () => {
    switch (scope) {
      case 'login':
      case 'audit':
        return (
          <Login
            entry={model}
            onChange={onChange}
            onTagsChange={onTagsChange}
            validate={validate}
          />
        )
      case 'card':
        return (
          <Card
            entry={model}
            onChange={onChange}
            onTagsChange={onTagsChange}
            validate={validate}
          />
        )
      case 'note':
        return (
          <Note
            entry={model}
            onChange={onChange}
            onTagsChange={onTagsChange}
            validate={validate}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="aside">
      {renderFields()}
      <div className="actions">
        <span className="cancel" onClick={onCancel}>
          {i18n('Cancel')}
        </span>
        <span className="button" onClick={onSave}>
          {i18n('Save')}
        </span>
      </div>
    </div>
  )
}

export default Form
