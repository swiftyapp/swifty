import { useState, useEffect } from 'react'
import { useStore, setCurrentEntry, setNoEntry, saveEntry } from '@/store'
import { useRevealed } from '@/hooks/useRevealed'
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
  const scope = useStore(state => state.filters.scope)
  const type: EntryType = scope === 'audit' ? 'login' : scope

  const [validate, setValidate] = useState(false)
  const [model, setModel] = useState<EntryDraft>(
    entry ? { ...entry } : defaults[type]
  )

  // When editing, secret fields arrive encrypted; swap in the decrypted values.
  const revealed = useRevealed(entry)
  useEffect(() => {
    if (revealed) setModel({ ...revealed })
  }, [revealed])

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
    if (model.id) setCurrentEntry(model.id)
    else setNoEntry()
  }

  const onSave = () => {
    if (isValid(model)) saveEntry(model)
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
