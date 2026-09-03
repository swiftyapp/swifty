import { openGenerator } from '@/store'
import { t } from '@/i18n'
import { relativeTime } from '@/utils/time'
import { RefreshGlyph } from '../../Main/icons'
import StrengthBar from '../StrengthBar'
import { MONO_LABEL } from '../tokens'
import Field from './Field'
import { useField, useFields } from './context'

// How long this password has been in place. `now` reads as "just now" rather
// than "changed now ago".
const rotationStamp = (iso?: string | string[]): string => {
  if (typeof iso !== 'string') return ''
  const ago = relativeTime(iso)
  if (!ago) return ''
  return ago === 'now'
    ? t('changed just now')
    : t('changed {t} ago').replace('{t}', ago)
}

export default function PasswordField({
  name = 'password',
  label = 'Password',
  required
}: {
  name?: string
  label?: string
  required?: boolean
}) {
  const { entry } = useFields()
  const { value, set, editing } = useField(name)
  const stamp = rotationStamp(entry.password_updated_at)

  return (
    <Field
      name={name}
      label={label}
      required={required}
      secure
      big
      maxLength={100}
      placeholder="••••••••"
      actions={
        editing ? (
          <button
            type="button"
            onClick={() => openGenerator(set)}
            className="flex cursor-pointer items-center gap-1.5 text-base text-accent hover:brightness-110"
          >
            <RefreshGlyph size={13} />
            {/* The word is its own element: the generator spec clicks it by text. */}
            <span>generate</span>
          </button>
        ) : undefined
      }
      below={
        (value || stamp) && (
          <>
            <StrengthBar password={value} />
            {stamp && <span className={MONO_LABEL}>{stamp}</span>}
          </>
        )
      }
    />
  )
}
