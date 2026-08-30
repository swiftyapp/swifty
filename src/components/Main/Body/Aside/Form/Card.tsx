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

export default function Card({ entry, validate, onChange, onTagsChange }: Props) {
  return (
    <>
      <Field label={t('Title')} name="title" validate={validate} entry={entry} onChange={onChange} maxLength={40} />
      <Field label={t('Number')} name="number" validate={validate} entry={entry} onChange={onChange} maxLength={19} />
      <Field label={t('Month')} name="month" validate={validate} entry={entry} onChange={onChange} maxLength={2} />
      <Field label={t('Year')} name="year" validate={validate} entry={entry} onChange={onChange} maxLength={4} />
      <Field label={t('CVC')} name="cvc" validate={validate} entry={entry} onChange={onChange} maxLength={4} />
      <SecureField label={t('Pin')} name="pin" validate={validate} entry={entry} onChange={onChange} maxLength={6} />
      <Field label={t('Name')} name="name" entry={entry} onChange={onChange} />
      <TagField entry={entry} onChange={onTagsChange} />
    </>
  )
}
