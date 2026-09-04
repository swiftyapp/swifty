import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { openGenerator } from '@/store'
import type { TKey } from '@/i18n'
import { relativeDuration, shortDate, toTime } from '@/utils/time'
import { RefreshGlyph } from '../../Main/icons'
import IconButton from '../IconButton'
import StrengthBar from '../StrengthBar'
import { MONO_LABEL } from '../tokens'
import Field from './Field'
import { useField, useFields } from './context'

// How long this password has been in place. `now` reads as "just now" rather
// than "changed now ago", and past a week — where the duration runs out — the
// date goes in a sentence of its own rather than "changed 05/06/2026 ago".
const rotationStamp = (t: TFunction, iso?: string | string[]): string => {
  if (typeof iso !== 'string') return ''
  const at = toTime(iso)
  if (at === null) return ''
  const ago = relativeDuration(iso)
  if (ago === 'now') return t('changed just now')
  if (ago) return t('changed {{ago}} ago', { ago })
  return t('changed on {{date}}', { date: shortDate(at) })
}

export default function PasswordField({
  name = 'password',
  label = 'Password',
  required
}: {
  name?: string
  label?: TKey
  required?: boolean
}) {
  const { t } = useTranslation()
  const { entry } = useFields()
  const { value, set, editing } = useField(name)
  const stamp = rotationStamp(t, entry.password_updated_at)

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
          <IconButton
            title={t('Generate')}
            testid="generate-password-link"
            onClick={() => openGenerator(set)}
          >
            <RefreshGlyph />
          </IconButton>
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
