import { useState, useEffect } from 'react'
import { setCurrentEntry, setNoEntry, saveEntry } from '@/store'
import { useRevealed } from '@/hooks/useRevealed'
import { kindOf } from '@/kinds'
import type { EntryDraft } from '@/defaults/entries'
import type { EntryMeta, EntryType } from '@/lib/commands'
import { t } from '@/i18n'
import Button from '@/components/elements/Button'
import Sheet from '@/components/elements/Sheet'
import { cx } from '@/utils/cx'
import type { FieldChange } from './helpers'

interface Props {
  // The kind being written. New entries are told which kind to be; an edit
  // passes the entry's own type.
  type: EntryType
  entry?: EntryMeta
}

export default function Form({ type, entry }: Props) {
  const kind = kindOf(type)
  const Fields = kind.Form

  const initial = (): EntryDraft => (entry ? { ...entry } : { ...kind.defaults })
  const [validate, setValidate] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [model, setModel] = useState<EntryDraft>(initial)
  // What the model looked like when it was last loaded — the dirty baseline.
  const [pristine, setPristine] = useState<EntryDraft>(initial)

  // When editing, secret fields arrive encrypted; swap in the decrypted values —
  // once. The hook refetches when the entry's `updatedAt` moves (e.g. a sync
  // merge landing mid-edit), and adopting that refetch here would silently
  // replace whatever the user has typed. The form's baseline is the state at
  // open; a concurrent change resolves through last-writer-wins on save.
  const revealed = useRevealed(entry)
  const [adopted, setAdopted] = useState(false)
  useEffect(() => {
    if (!revealed || adopted) return
    setAdopted(true)
    setModel({ ...revealed })
    setPristine({ ...revealed })
  }, [revealed, adopted])

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
    if (!kind.isValid(model)) {
      setValidate(true)
      return
    }
    setSaveError(null)
    // Never imply success on a failed write: surface the error, leave the form open.
    saveEntry(model).catch(() => setSaveError(t('Could not save. Please try again.')))
  }

  const footer = (
    <>
      <span className="flex-1 font-mono text-xs text-text3">{t(kind.label)}</span>
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
      testid="entry-sheet"
    >
      <div className="flex flex-col gap-4">
        <Fields
          entry={model}
          onChange={onChange}
          onTagsChange={onTagsChange}
          validate={validate}
          setField={patch}
        />
      </div>

      {saveError && (
        <div
          data-testid="entry-save-error"
          className="mt-4 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad"
        >
          {saveError}
        </div>
      )}
    </Sheet>
  )
}
