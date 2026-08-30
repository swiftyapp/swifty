import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setCurrentEntry, setNoEntry } from '@/store/entriesSlice'
import { saveEntry } from '@/store/thunks'
import { isValid } from '@/services/entries'
import defaults, { type EntryDraft } from '@/defaults/entries'
import type { Entry, EntryType } from '@/lib/commands'
import { t } from '@/i18n'
import Login from './Login'
import Card from './Card'
import Note from './Note'
import type { FieldChange } from './helpers'

interface Props {
  entry?: Entry
}

export default function Form({ entry }: Props) {
  const dispatch = useAppDispatch()
  const scope = useAppSelector(state => state.filters.scope)
  const type: EntryType = scope === 'audit' ? 'login' : scope

  const [validate, setValidate] = useState(false)
  const [model, setModel] = useState<EntryDraft>(
    entry ? { ...entry } : defaults[type]
  )

  const patch = (name: string, value: string | string[]) =>
    setModel(current => ({
      ...current,
      [name]: value,
      ...(name === 'password'
        ? { password_updated_at: new Date().toISOString() }
        : {})
    }))

  const onChange = (event: FieldChange) =>
    patch(event.target.name, event.target.value)
  const onTagsChange = (tags: string[]) => patch('tags', tags)

  const onCancel = () => {
    if (model.id) dispatch(setCurrentEntry(model.id))
    else dispatch(setNoEntry())
  }

  const onSave = () => {
    if (isValid(model)) dispatch(saveEntry(model))
    else setValidate(true)
  }

  const fields = () => {
    switch (type) {
      case 'card':
        return <Card entry={model} onChange={onChange} onTagsChange={onTagsChange} validate={validate} />
      case 'note':
        return <Note entry={model} onChange={onChange} onTagsChange={onTagsChange} validate={validate} />
      default:
        return (
          <Login
            entry={model}
            onChange={onChange}
            onTagsChange={onTagsChange}
            validate={validate}
            setField={patch}
          />
        )
    }
  }

  return (
    <div className="aside">
      {fields()}
      <div className="actions">
        <span className="cancel" onClick={onCancel}>
          {t('Cancel')}
        </span>
        <span className="button" onClick={onSave}>
          {t('Save')}
        </span>
      </div>
    </div>
  )
}
