import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import Error from '../Error'
import IconButton from '../IconButton'
import {
  EyeGlyph,
  FingerprintGlyph,
  LockGlyph
} from '@/components/Main/icons'
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

const EyeIcon = <EyeGlyph size={16} />
const FingerprintIcon = <FingerprintGlyph size={16} />
const LockIcon = <LockGlyph size={16} />

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
        {/* Deliberately off the type/tracking scales: the passphrase field is a
            theatrical one-off (26/22px, .3em cuts) that no other surface reuses. */}
        <input
          type={reveal ? 'text' : 'password'}
          className="absolute inset-0 w-full border-0 bg-transparent text-center font-mono tracking-[0.3em] outline-none placeholder:text-[15px] placeholder:tracking-[0em] placeholder:text-text3"
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
                'font-mono text-xs uppercase tracking-label transition-colors',
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
