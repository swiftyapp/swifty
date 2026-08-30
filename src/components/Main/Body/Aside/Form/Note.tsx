import type { EntryDraft } from '@/defaults/entries'
import { t } from '@/i18n'
import Field from './Field'
import SecureField from './SecureField'
import type { FieldChange } from './helpers'
import TagField from './TagField'

interface Props {
  entry: EntryDraft
  validate: boolean
  onChange: (event: FieldChange) => void
  onTagsChange: (tags: string[]) => void
}

export default function Note({ entry, validate, onChange, onTagsChange }: Props) {
  return (
    <>
      <Field label={t('Title')} name="title" entry={entry} onChange={onChange} validate={validate} maxLength={40} />
      <SecureField label={t('Note')} name="note" entry={entry} onChange={onChange} validate={validate} rows={15} />
      <TagField entry={entry} onChange={onTagsChange} />
    </>
  )
}
