import { openGenerator } from '@/store'
import type { EntryDraft } from '@/defaults/entries'
import { t } from '@/i18n'
import Field from './Field'
import SecureField from './SecureField'
import type { FieldChange } from './helpers'
import TagField from './TagField'
import { RefreshGlyph } from '../../../icons'

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
    openGenerator(password => setField('password', password))

  return (
    <>
      <Field label={t('Title')} name="title" validate={validate} entry={entry} onChange={onChange} maxLength={40} />
      <Field label={t('Website')} name="website" entry={entry} onChange={onChange} />
      <Field label={t('Username')} name="username" validate={validate} entry={entry} onChange={onChange} maxLength={40} />
      <SecureField label={t('Password')} name="password" validate={validate} entry={entry} onChange={onChange} maxLength={100}>
        <span
          className="flex cursor-pointer items-center gap-1.5 text-base text-accent hover:brightness-110"
          onClick={generate}
        >
          <RefreshGlyph size={13} />
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
