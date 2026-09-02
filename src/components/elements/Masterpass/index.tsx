import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import Error from '../Error'
import IconButton from '../IconButton'
import { EyeGlyph, FingerprintGlyph } from '@/components/Main/icons'
import Dots from './Dots'
import KeyCuts from './KeyCuts'

interface Props {
  error?: string | null
  touchID?: boolean
  disabled?: boolean
  placeholder?: string
  testid?: string
  // `lock` is the full unlock presentation (in-field actions + key-cut rule);
  // `compact` (default) is the plain centered field used by setup / restore.
  variant?: 'compact' | 'lock'
  // Lock only: tint the rule/cuts as invalid without rendering an inline error
  // (the lock screen surfaces the message in its eyebrow instead).
  invalid?: boolean
  // Lock only: hold the rule/cuts on accent while the unlock lands.
  success?: boolean
  onEnter?: (value: string) => void
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  onTouchID?: () => void
}

const EyeIcon = <EyeGlyph size={16} />
const SmallEyeIcon = <EyeGlyph size={14} />
const FingerprintIcon = <FingerprintGlyph size={16} />

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
  success,
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

  const cutsTone = success || flash ? 'accent' : bad ? 'bad' : 'idle'

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

        {/*
          Lock: both alternatives to typing live inside the field. Touch ID is
          the primary one (always present, full weight); reveal is a secondary
          modifier of what you're typing, so it only appears once there is
          something to reveal, one tier smaller and dimmer.
        */}
        {lock && (touchID || value.length > 0) && (
          <div className="absolute right-0 flex items-center gap-1">
            {value.length > 0 && (
              <IconButton
                label={t('Reveal passphrase')}
                className="animate-fade"
                muted
                active={reveal}
                onClick={() => setReveal(r => !r)}
              >
                {SmallEyeIcon}
              </IconButton>
            )}
            {value.length > 0 && touchID && (
              <span aria-hidden className="h-4 w-px bg-line" />
            )}
            {touchID && (
              <IconButton
                label={t('Touch ID')}
                className="touchid"
                onClick={onTouchID}
              >
                {FingerprintIcon}
              </IconButton>
            )}
          </div>
        )}
      </div>

      {lock ? (
        <KeyCuts count={value.length} tone={cutsTone} />
      ) : (
        <>
          <KeyCuts count={value.length} tone={bad ? 'bad' : 'idle'} />
          <Error error={error} />
        </>
      )}
    </div>
  )
}
