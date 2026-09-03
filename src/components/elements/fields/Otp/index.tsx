import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { copy } from '@/services/copy'
import { useOtp } from '@/hooks/useOtp'
import Panel from '../../Panel'
import { MONO_LABEL } from '../../tokens'
import { useField } from '../context'
import Dial from './Dial'
import { otpSecret } from './secret'

// The one field that is a panel rather than a row: a code with a lifetime needs
// the dial, and the dial is the same size in both modes. Reading, it offers the
// current code; editing, the secret's own input with that code as a live
// preview — the only proof that what was pasted actually works.
export default function OtpField({
  name = 'otp',
  label = 'OTP'
}: {
  name?: string
  label?: TKey
}) {
  const { t } = useTranslation()
  const { value, set, editing } = useField(name)
  const parsed = otpSecret(value)
  const { code, time } = useOtp(parsed)

  // Reading, the panel is worth its column only once a code has arrived.
  // Passing the raw value through when it failed to parse bought nothing but a
  // dead dial and a "Copy code" button that copied '' — the backend rejects
  // exactly what `otpSecret` rejects.
  if (!editing && !code) return null

  return (
    <Panel className="flex flex-col items-center p-3.5">
      <div className={`self-stretch ${MONO_LABEL}`}>{t(label)}</div>

      {editing && (
        <input
          name={name}
          // The panel's heading is not a label element, so the input names
          // itself rather than borrowing the row geometry it does not use.
          aria-label={t(label)}
          value={value}
          placeholder={t('base32 secret or otpauth:// link')}
          autoComplete="off"
          spellCheck={false}
          onChange={event => set(event.target.value)}
          // A pasted otpauth:// link collapses to the secret it carries, so the
          // vault only ever stores the thing the generator needs.
          onBlur={() => set(parsed || value.trim())}
          className={`mt-2.5 h-6 w-full self-stretch truncate border-b bg-transparent text-center font-mono text-base text-text outline-none transition-colors placeholder:text-text3 ${
            value && !parsed ? 'border-bad' : 'border-line2 focus:border-accent-line'
          }`}
        />
      )}

      {parsed && <Dial code={code} time={time} />}

      {editing && value !== '' && !parsed && (
        <div className="mt-3 text-base text-bad">{t('Not a one-time-password secret')}</div>
      )}

      {!editing && (
        <button
          type="button"
          onClick={() => copy(code)}
          className="mt-3 grid h-7 w-full cursor-pointer place-items-center rounded-sm border border-line2 text-base text-text2 transition-colors hover:border-accent-line hover:text-text"
        >
          {t('Copy code')}
        </button>
      )}
    </Panel>
  )
}
