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

// The macOS Touch ID rose, so the fingerprint reads as the system affordance
// rather than another monochrome glyph. Sized to nearly fill the 28px button:
// the fingerprint should read large while the hover target stays on the grid.
const TouchIdIcon = (
  <span className="text-[#ee5d6f]">
    <FingerprintGlyph size={22} />
  </span>
)

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
        // Quiet shared metrics: placeholder and revealed value are 15px on the
        // secret tracking (the revealed-secret tier); only the ink differs.
        // The theatrical size lives in the dot overlay, not the text.
        'absolute inset-0 w-full border-0 bg-transparent text-center font-sans text-[15px] tracking-secret outline-none placeholder:text-text3',
        lock && 'rounded-xl px-10'
      )}
      style={{
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
          'relative mx-auto flex h-12 max-w-[380px] items-stretch rounded-xl border bg-detail shadow-[var(--lockfield-shadow)] transition-all duration-300',
          bad
            ? 'border-bad/60 ring-4 ring-bad/10 animate-[nudge_420ms_ease_both]'
            : success
              ? 'border-good/50 ring-4 ring-good/15'
              : 'border-text/12 focus-within:border-accent-line focus-within:ring-4 focus-within:ring-accent-soft',
          disabled && !success && 'opacity-60'
        )}
      >
        <div className="relative flex-1">
          {input}
          {!reveal && (
            <Dots count={value.length} caret={focused && !disabled} />
          )}
          {/* Reveal is a secondary modifier of what you're typing, so it only
              appears once there is something to reveal, small and dim. */}
          {value.length > 0 && (
            <IconButton
              label={t('Reveal passphrase')}
              className="animate-fade absolute right-1.5 top-1/2 -translate-y-1/2"
              muted
              active={reveal}
              onClick={() => setReveal(r => !r)}
            >
              {SmallEyeIcon}
            </IconButton>
          )}
        </div>

        {/* Touch ID is the card's own end segment: a taller divider than the
            reveal tier, and the fingerprint in the macOS Touch ID rose. */}
        {touchID && (
          <>
            <span aria-hidden className="my-auto h-7 w-px bg-line" />
            <IconButton
              label={t('Touch ID')}
              className="touchid mx-1.5 my-auto"
              onClick={onTouchID}
            >
              {TouchIdIcon}
            </IconButton>
          </>
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
