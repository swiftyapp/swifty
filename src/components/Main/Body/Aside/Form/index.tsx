import { useState, useEffect } from 'react'
import { useStore, setCurrentEntry, setNoEntry, saveEntry } from '@/store'
import { useRevealed } from '@/hooks/useRevealed'
import { isValid } from '@/services/entries'
import defaults, { type EntryDraft } from '@/defaults/entries'
import type { EntryMeta, EntryType } from '@/lib/commands'
import { t } from '@/i18n'
import Login from './Login'
import Card from './Card'
import Note from './Note'
import Button from '@/components/elements/Button'
import { MONO_LABEL } from '../ui'
import type { FieldChange } from './helpers'

interface Props {
  entry?: EntryMeta
}

const KIND_LABEL: Record<EntryType, string> = {
  login: 'Login',
  card: 'Card',
  note: 'Secure note'
}

export default function Form({ entry }: Props) {
  const scope = useStore(state => state.filters.scope)
  const type: EntryType = scope === 'audit' ? 'login' : scope

  const [validate, setValidate] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
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
    if (!isValid(model)) {
      setValidate(true)
      return
    }
    setSaveError(null)
    // Never imply success on a failed write: surface the error, leave the form open.
    saveEntry(model).catch(() => setSaveError(t('Could not save. Please try again.')))
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
    <div className="mx-auto max-w-[560px]">
      <div className={MONO_LABEL}>{t(KIND_LABEL[type])}</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-display text-text">
        {entry ? t('Edit') : t('New Secret')}
      </h1>

      <div className="mt-6 flex flex-col gap-4">{fields()}</div>

      {saveError && (
        <div className="mt-4 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad">
          {saveError}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="cancel-entry-button"
          onClick={onCancel}
          className="h-9 cursor-pointer rounded-sm px-4 text-base text-text2 transition-colors hover:text-text"
        >
          {t('Cancel')}
        </button>
        <Button testid="save-entry-button" onClick={onSave}>
          {t('Save')}
        </Button>
      </div>
    </div>
  )
}
