import { generatePassword } from '@/lib/commands'
import { getProps } from '@/defaults/generator'
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
  setField: (name: string, value: string) => void
}

export default function Login({
  entry,
  validate,
  onChange,
  onTagsChange,
  setField
}: Props) {
  const generate = () =>
    generatePassword(getProps())
      .then(password => setField('password', password))
      .catch(() => {})

  return (
    <>
      <Field label={t('Title')} name="title" validate={validate} entry={entry} onChange={onChange} maxLength={40} />
      <Field label={t('Website')} name="website" entry={entry} onChange={onChange} />
      <Field label={t('Username')} name="username" validate={validate} entry={entry} onChange={onChange} maxLength={40} />
      <SecureField label={t('Password')} name="password" validate={validate} entry={entry} onChange={onChange} maxLength={100}>
        <span className="action" onClick={generate}>
          generate
        </span>
      </SecureField>
      <SecureField label={t('OTP')} name="otp" entry={entry} onChange={onChange} />
      <Field label={t('Email')} name="email" entry={entry} onChange={onChange} />
      <TagField entry={entry} onChange={onTagsChange} />
      <Field label={t('Note')} name="note" entry={entry} onChange={onChange} rows={5} />
    </>
  )
}
