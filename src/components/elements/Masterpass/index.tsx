import { useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import Error from '../Error'
import Dots from './Dots'
import KeyCuts from './KeyCuts'

interface Props {
  error?: string | null
  touchID?: boolean
  disabled?: boolean
  placeholder?: string
  testid?: string
  // `lock` is the full unlock presentation (key-cut rule + action row);
  // `compact` (default) is the plain centered field used by setup / restore.
  variant?: 'compact' | 'lock'
  // Lock only: tint the rule/cuts as invalid without rendering an inline error
  // (the lock screen surfaces the message in its eyebrow instead).
  invalid?: boolean
  onEnter?: (value: string) => void
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  onTouchID?: () => void
}

function IconButton({
  children,
  label,
  className,
  active,
  onClick
}: {
  children: ReactNode
  label: string
  className?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'grid h-[30px] w-[30px] place-items-center rounded-lg border-0 bg-transparent transition-colors hover:bg-hover',
        active ? 'text-accent' : 'text-text3 hover:text-text',
        className
      )}
    >
      {children}
    </button>
  )
}

const EyeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.9 12S6.7 6 12 6s9.1 6 9.1 6-3.8 6-9.1 6-9.1-6-9.1-6Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
)

const FingerprintIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M12 4.6c-3.6 0-6.5 2.7-6.5 6v3.1M12 4.6c3.6 0 6.5 2.7 6.5 6v5.1M9 12.3c0-1.6 1.3-2.8 3-2.8s3 1.2 3 2.8v5.5M12 13v6.4M5.9 17.6v1.8M18.4 18.7v.9" />
  </svg>
)

const LockIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.8" y="11" width="14.4" height="9.2" rx="2.4" />
    <path d="M7.7 11V8.2a4.3 4.3 0 0 1 8.6 0V11" />
  </svg>
)

// Shared master-passphrase field. The real value lives in the (uncontrolled)
// input; a mirrored copy drives the dot overlay and key-cut count. Masking is
// done with a text-transparent input + custom dots so the caret and letter
// spacing match the design in both themes.
export default function Masterpass({
  error,
  touchID,
  disabled,
  placeholder,
  testid,
  variant = 'compact',
  invalid,
  onEnter,
  onChange,
  onTouchID
}: Props) {
  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [focused, setFocused] = useState(false)
  const [flash, setFlash] = useState(false)

  const lock = variant === 'lock'
  const bad = !!error || !!invalid

  const doSubmit = (val: string) => {
    if (disabled || val === '') return
    if (lock) {
      setFlash(true)
      window.setTimeout(() => setFlash(false), 500)
    }
    onEnter?.(val)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value)
    onChange?.(event)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') doSubmit(event.currentTarget.value)
  }

  const cutsTone = flash ? 'accent' : bad ? 'bad' : 'idle'
  const hint =
    value.length === 0
      ? t('Enter your passphrase')
      : `${value.length} ${t('characters')}`

  return (
    <div className="w-full">
      <div
        className={cx(
          'relative flex items-center justify-center',
          lock ? 'h-16' : 'h-14'
        )}
      >
        <input
          type={reveal ? 'text' : 'password'}
          className="absolute inset-0 w-full border-0 bg-transparent text-center font-mono tracking-[0.3em] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-text3"
          style={{
            fontSize: lock ? 26 : 22,
            color: reveal ? 'var(--c-text)' : 'transparent',
            caretColor: reveal ? 'var(--c-accent)' : 'transparent'
          }}
          placeholder={placeholder || t('Master Password')}
          disabled={disabled}
          data-testid={testid}
          autoFocus
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {!reveal && <Dots count={value.length} caret={focused && !disabled} />}

        {!lock && (
          <IconButton
            label={t('Reveal passphrase')}
            className="absolute right-0"
            active={reveal}
            onClick={() => setReveal(r => !r)}
          >
            {EyeIcon}
          </IconButton>
        )}
      </div>

      {lock ? (
        <>
          <KeyCuts count={value.length} tone={cutsTone} />
          <div className="mt-5 flex items-center justify-between gap-4">
            <span
              className={cx(
                'font-mono text-[11px] uppercase tracking-[0.14em] transition-colors',
                bad ? 'text-bad' : 'text-text3'
              )}
            >
              {hint}
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                label={t('Reveal passphrase')}
                active={reveal}
                onClick={() => setReveal(r => !r)}
              >
                {EyeIcon}
              </IconButton>
              {touchID && (
                <IconButton
                  label={t('Touch ID')}
                  className="touchid"
                  onClick={onTouchID}
                >
                  {FingerprintIcon}
                </IconButton>
              )}
              <IconButton
                label={t('Unseal')}
                active={value.length > 0}
                onClick={() => doSubmit(value)}
              >
                {LockIcon}
              </IconButton>
            </div>
          </div>
        </>
      ) : (
        <>
          <KeyCuts count={value.length} tone={bad ? 'bad' : 'idle'} />
          <Error error={error} />
        </>
      )}
    </div>
  )
}
