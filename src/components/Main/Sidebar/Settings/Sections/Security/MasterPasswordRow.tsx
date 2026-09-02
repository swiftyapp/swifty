import { useState } from 'react'
import { changeMasterPassword } from '@/lib/commands'
import { t } from '@/i18n'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import ExpandableRow from '../ExpandableRow'

const FIELDS: { name: string; label: string }[] = [
  { name: 'current_password', label: 'Current Password' },
  { name: 'new_password', label: 'New Password' },
  { name: 'new_password_repeat', label: 'Repeat New Password' }
]

export default function MasterPasswordRow() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = values.current_password ?? ''
  const next = values.new_password ?? ''
  const repeat = values.new_password_repeat ?? ''
  const disabled = !current || !next || !repeat || next !== repeat

  const onSubmit = () => {
    if (disabled) return
    setProcessing(true)
    setError(null)
    setSuccess(null)
    changeMasterPassword(current, next)
      .then(() => {
        setValues({})
        setSuccess(t('Successfully changed password'))
      })
      .catch(err => setError(String(err?.message ?? err)))
      .finally(() => setProcessing(false))
  }

  return (
    <ExpandableRow
      label={t('Change master password')}
      action={t('Change…')}
      testid="settings-master-password-row"
    >
      <div className="flex flex-col gap-2.5">
        {FIELDS.map(field => (
          <label key={field.name} className="flex items-center gap-3">
            <span className="w-[160px] flex-none text-base text-text2">
              {t(field.label)}
            </span>
            <input
              type="password"
              name={field.name}
              className={`${inputClass} max-w-xs`}
              value={values[field.name] ?? ''}
              onChange={e => setValues({ ...values, [field.name]: e.target.value })}
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="md"
            testid="change-password-submit"
            onClick={onSubmit}
            disabled={disabled}
            loading={processing}
          >
            {t('Update')}
          </Button>
          {error && (
            <span data-testid="change-password-error" className="text-base text-bad">
              {error}
            </span>
          )}
          {success && (
            <span data-testid="change-password-success" className="text-base text-good">
              {success}
            </span>
          )}
        </div>
      </div>
    </ExpandableRow>
  )
}
