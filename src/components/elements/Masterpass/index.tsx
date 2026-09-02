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
  // `lock` is the signature card presentation of the lock screen; `compact`
  // (default) is the plain centered field used by setup / restore.
  variant?: 'compact' | 'lock'
  // Lock only: paint the card as invalid without rendering an inline error
  // (the lock screen surfaces the message in its eyebrow instead).
  invalid?: boolean
  // Lock only: hold the card on the success tint while the unlock lands.
  success?: boolean
  onEnter?: (value: string) => void
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  onTouchID?: () => void
}

const EyeIcon = <EyeGlyph size={16} />
const SmallEyeIcon = <EyeGlyph size={14} />
const FingerprintIcon = <FingerprintGlyph size={16} />

// Shared master-passphrase field. The real value lives in the (uncontrolled)
// input; a mirrored copy drives the dot overlay. Masking is done with a
// text-transparent input + custom dots so the caret and letter spacing match
// the design in both themes.
//
// The lock variant is deliberately unlike every other field in the app: a
// floating white card with big centered dots, whose halo carries the state —
// accent on focus, red (plus a shake) on a bad passphrase, green while a
// successful unlock lands. Its only chrome is Touch ID (primary) and reveal
// (secondary, only once there is something to reveal) on the right edge.
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

  const lock = variant === 'lock'
  const bad = !!error || !!invalid

  const doSubmit = (val: string) => {
    if (disabled || val === '') return
    onEnter?.(val)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value)
    onChange?.(event)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') doSubmit(event.currentTarget.value)
  }

  const input = (
    <input
      type={reveal ? 'text' : 'password'}
      className={cx(
        'absolute inset-0 w-full border-0 bg-transparent text-center font-mono tracking-[0.3em] outline-none placeholder:text-[15px] placeholder:tracking-[0em] placeholder:text-text3',
        lock && 'rounded-xl px-14'
      )}
      style={{
        fontSize: lock ? 24 : 22,
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
  )

  if (lock) {
    return (
      <div
        className={cx(
          'relative mx-auto h-[60px] max-w-[460px] rounded-xl border bg-detail shadow-[var(--lockfield-shadow)] transition-all duration-300',
          bad
            ? 'border-bad/60 ring-4 ring-bad/10 animate-[nudge_420ms_ease_both]'
            : success
              ? 'border-good/50 ring-4 ring-good/15'
              : 'border-line focus-within:border-accent-line focus-within:ring-4 focus-within:ring-accent-soft',
          disabled && !success && 'opacity-60'
        )}
      >
        {input}
        {!reveal && <Dots count={value.length} caret={focused && !disabled} />}

        {/*
          Both alternatives to typing live inside the card. Touch ID is the
          primary one (always present, full weight); reveal is a secondary
          modifier of what you're typing, so it only appears once there is
          something to reveal, one tier smaller and dimmer.
        */}
        {(touchID || value.length > 0) && (
          <div className="absolute inset-y-0 right-3 flex items-center gap-1">
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
    )
  }

  return (
    <div className="w-full">
      <div className="relative flex h-14 items-center justify-center">
        {input}
        {!reveal && <Dots count={value.length} caret={focused && !disabled} />}
        <IconButton
          label={t('Reveal passphrase')}
          className="absolute right-0"
          active={reveal}
          onClick={() => setReveal(r => !r)}
        >
          {EyeIcon}
        </IconButton>
      </div>
      <KeyCuts count={value.length} tone={bad ? 'bad' : 'idle'} />
      <Error error={error} />
    </div>
  )
}
