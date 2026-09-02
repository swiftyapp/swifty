import { t } from '@/i18n'
import Field from '@/components/Main/Body/Aside/Form/Field'
import SecureField from '@/components/Main/Body/Aside/Form/SecureField'
import TagField from '@/components/Main/Body/Aside/Form/TagField'
import type { FormProps } from '../types'

export default function Form({ entry, validate, onChange, onTagsChange }: FormProps) {
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
