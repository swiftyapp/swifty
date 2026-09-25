import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { changeMasterPassword } from '@/api/auth'
import { describeError } from '@/api/errors'
import type { TKey } from '@/i18n'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import IconButton from '@/components/elements/IconButton'
import PasswordStrength from '@/components/elements/PasswordStrength'
import { inputClass } from '@/components/elements/formStyles'
import { verbatimInput } from '@/components/elements/inputProps'
import { EyeGlyph, EyeOffGlyph, KeyGlyph } from '@/components/Main/icons'
import ExpandableRow from '../ExpandableRow'

type Name = 'current_password' | 'new_password' | 'new_password_repeat'

// One labelled field of the form: the label above, the input (and whatever
// hangs off it) below.
function Field({
  id,
  label,
  children
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-medium text-text2">
        {label}
      </label>
      {children}
    </div>
  )
}

export default function MasterPasswordRow() {
  const { t } = useTranslation()
  const id = useId()
  const [values, setValues] = useState<Partial<Record<Name, string>>>({})
  const [shown, setShown] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = values.current_password ?? ''
  const next = values.new_password ?? ''
  const repeat = values.new_password_repeat ?? ''
  const mismatch = !!repeat && next !== repeat
  const disabled = !current || !next || !repeat || mismatch

  const input = (name: Name, type = 'password', className?: string) => (
    <input
      id={`${id}-${name}`}
      type={type}
      name={name}
      {...verbatimInput}
      className={cx(inputClass, className)}
      value={values[name] ?? ''}
      onChange={e => setValues({ ...values, [name]: e.target.value })}
    />
  )

  const field = (name: Name, label: TKey, control: ReactNode) => (
    <Field id={`${id}-${name}`} label={t(label)}>
      {control}
    </Field>
  )

  const onSubmit = () => {
    if (disabled) return
    setProcessing(true)
    setError(null)
    setSuccess(null)
    changeMasterPassword(current, next)
      .then(unchanged => {
        setValues({})
        // The change reaches every workspace that shares the password, so the
        // ones it did not reach are the news: a workspace with a password of
        // its own keeps it, and so does one whose own re-key failed.
        setSuccess(
          unchanged?.length
            ? t('Password changed. Some workspaces on this device kept their own password.')
            : t('Successfully changed password')
        )
      })
      .catch((err: unknown) => setError(describeError(err)))
      .finally(() => setProcessing(false))
  }

  return (
    <ExpandableRow
      label={t('Master password')}
      description={t(
        'Every workspace on this device that shares this password changes with it'
      )}
      icon={<KeyGlyph size={16} />}
      action={t('Change…')}
      testid="settings-master-password-row"
    >
      <div className="flex max-w-sm flex-col gap-3">
        {field('current_password', 'Current Password', input('current_password'))}
        {field(
          'new_password',
          'New Password',
          <>
            <div className="relative">
              {input('new_password', shown ? 'text' : 'password', 'pr-10')}
              <div className="absolute top-1/2 right-1 -translate-y-1/2">
                <IconButton
                  label={shown ? t('Hide') : t('Show')}
                  active={shown}
                  onClick={() => setShown(!shown)}
                >
                  {shown ? <EyeOffGlyph /> : <EyeGlyph />}
                </IconButton>
              </div>
            </div>
            <PasswordStrength password={next} />
          </>
        )}
        {field(
          'new_password_repeat',
          'Repeat New Password',
          <>
            {input('new_password_repeat')}
            {mismatch && (
              <span className="text-base text-bad">{t("Passwords don't match yet.")}</span>
            )}
          </>
        )}
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
