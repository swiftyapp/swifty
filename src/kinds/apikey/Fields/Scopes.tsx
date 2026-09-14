import { useTranslation } from 'react-i18next'
import CopyButton from '@/components/elements/CopyButton'
import { Field, FieldRow, useField } from '@/components/elements/fields'
import { CHIP } from '@/components/elements/fields/chip'
import { HOVER_ONLY } from '@/components/elements/tokens'
import { scopesOf } from '../keyInfo'

// What the key may do. Typed as one line, however the issuer lists them; read
// as chips, one per scope, since that is how every issuer's console shows them.
export default function Scopes() {
  const { t } = useTranslation()
  const { value, editing } = useField('scopes')

  if (editing) return <Field name="scopes" label="Scopes" placeholder="read:user repo …" />

  const scopes = scopesOf(value)
  if (scopes.length === 0) return null

  return (
    <FieldRow
      label="Scopes"
      actions={
        <span className={HOVER_ONLY}>
          <CopyButton value={scopes.join(' ')} title={t('Copy')} />
        </span>
      }
    >
      {() => (
        <span className="flex flex-wrap gap-1.5 py-px" data-testid="entry-value-scopes">
          {scopes.map(scope => (
            <span key={scope} className={`${CHIP} font-mono`}>
              {scope}
            </span>
          ))}
        </span>
      )}
    </FieldRow>
  )
}
