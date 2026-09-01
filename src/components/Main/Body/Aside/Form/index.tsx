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
import Sheet from '@/components/elements/Sheet'
import { cx } from '@/utils/cx'
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

  const initial = (): EntryDraft => (entry ? { ...entry } : defaults[type])
  const [validate, setValidate] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [model, setModel] = useState<EntryDraft>(initial)
  // What the model looked like when it was last loaded — the dirty baseline.
  const [pristine, setPristine] = useState<EntryDraft>(initial)

  // When editing, secret fields arrive encrypted; swap in the decrypted values.
  const revealed = useRevealed(entry)
  useEffect(() => {
    if (!revealed) return
    setModel({ ...revealed })
    setPristine({ ...revealed })
  }, [revealed])

  const dirty = JSON.stringify(model) !== JSON.stringify(pristine)

  const patch = (name: string, value: string | string[]) => {
    setConfirmDiscard(false)
    setModel(current => ({
      ...current,
      [name]: value,
      ...(name === 'password'
        ? { password_updated_at: new Date().toISOString() }
        : {})
    }))
  }

  const onChange = (event: FieldChange) =>
    patch(event.target.name, event.target.value)
  const onTagsChange = (tags: string[]) => patch('tags', tags)

  const close = () => {
    if (model.id) setCurrentEntry(model.id)
    else setNoEntry()
  }

  // Esc / scrim / Cancel. Unsaved edits arm an inline confirm on the Cancel
  // button instead of a blocking dialog; the next request discards.
  const onCancel = () => {
    if (!dirty || confirmDiscard) return close()
    setConfirmDiscard(true)
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

  const footer = (
    <>
      <span className="flex-1 font-mono text-xs text-text3">{t(KIND_LABEL[type])}</span>
      <button
        type="button"
        data-testid="cancel-entry-button"
        onClick={onCancel}
        className={cx(
          'h-9 cursor-pointer rounded-sm px-4 text-base transition-colors',
          confirmDiscard ? 'text-bad hover:brightness-110' : 'text-text2 hover:text-text'
        )}
      >
        {confirmDiscard ? t('Discard changes?') : t('Cancel')}
      </button>
      <Button testid="save-entry-button" kbd="⌘⏎" onClick={onSave}>
        {t('Save')}
      </Button>
    </>
  )

  return (
    <Sheet
      title={entry ? t('Edit entry') : t('New entry')}
      onClose={onCancel}
      onSubmit={onSave}
      footer={footer}
    >
      <div className="flex flex-col gap-4">{fields()}</div>

      {saveError && (
        <div className="mt-4 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad">
          {saveError}
        </div>
      )}
    </Sheet>
  )
}
