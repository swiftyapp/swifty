import { t } from '@/i18n'
import Field from '@/components/Main/Body/Aside/Form/Field'
import SecureField from '@/components/Main/Body/Aside/Form/SecureField'
import TagField from '@/components/Main/Body/Aside/Form/TagField'
import type { FormProps } from '../types'

export default function Form({ entry, validate, onChange, onTagsChange }: FormProps) {
  return (
    <>
      <Field label={t('Title')} name="title" entry={entry} onChange={onChange} validate={validate} maxLength={40} />
      <SecureField label={t('Note')} name="note" entry={entry} onChange={onChange} validate={validate} rows={15} />
      <TagField entry={entry} onChange={onTagsChange} />
    </>
  )
}
