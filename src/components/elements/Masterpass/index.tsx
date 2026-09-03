import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent
} from 'react'
import { cx } from '@/utils/cx'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import Error from '../Error'
import IconButton from '../IconButton'
import { EyeGlyph, EyeOffGlyph, FingerprintGlyph } from '@/components/Main/icons'
import Dots, { CELL } from './Dots'
import KeyCuts from './KeyCuts'

interface Props {
  error?: string | null
  touchID?: boolean
  // The field genuinely must not accept input (lockout countdown); dims it.
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
  // Lock only: the submitted passphrase is being verified (key derivation is
  // deliberately slow) — ripple the dots and orbit the halo.
  pending?: boolean
  onEnter?: (value: string) => void
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  onTouchID?: () => void
}

// Shared master-passphrase field. The real value and selection live in the
// input; mirrored copies drive the dot overlay. Masking is done with a
// text-transparent input + custom dots so the caret and letter spacing match
// the design in both themes. Because the input's own glyph geometry never
// matches the fixed cell grid, clicks are mapped to a character index against
// the drawn cells rather than left to the browser, and the overlay caret tracks
// the input's real selection so it always shows where the next edit lands.
//
// The lock variant is deliberately unlike every other field in the app: a
// white card set gently into the window ground (see --lockfield-shadow) with
// big centered dots, whose border + halo carry the state — accent on focus,
// red (plus a shake) on a bad passphrase, green while a successful unlock
// lands — while focus also cuts a touch deeper. Its only chrome is Touch ID
// (primary) and reveal (secondary, only once there is something to reveal) on
// the right edge.
export default function Masterpass({
  error,
  touchID,
  disabled,
  placeholder,
  testid,
  variant = 'compact',
  invalid,
  success,
  pending,
  onEnter,
  onChange,
  onTouchID
}: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [focused, setFocused] = useState(false)
  const [selection, setSelection] = useState<[number, number]>([0, 0])
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const lock = variant === 'lock'
  const bad = !!error || !!invalid
  // The input can't accept keystrokes while locked out, verifying, or during
  // the success hold; only the lockout also dims the card.
  const inert = !!disabled || !!success || !!pending

  // Disabling the input (verifying / lockout) blurs it; hand focus back the
  // moment it re-enables so a failed attempt can be retyped immediately.
  useEffect(() => {
    if (lock && !inert && document.activeElement !== inputRef.current)
      inputRef.current?.focus()
  }, [lock, inert])

  const doSubmit = (val: string) => {
    if (inert || val === '') return
    onEnter?.(val)
  }

  // Mirror the input's selection into state so the overlay caret follows it.
  // Called from every event that can move it (typing, arrows, select-all,
  // focus, and our own click mapping).
  const syncSelection = () => {
    const el = inputRef.current
    if (!el) return
    const end = el.value.length
    setSelection([el.selectionStart ?? end, el.selectionEnd ?? end])
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value)
    syncSelection()
    onChange?.(event)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') doSubmit(event.currentTarget.value)
  }

  // Place the caret on the cell boundary nearest the click. The browser would
  // otherwise position it by the input's own (transparent, differently spaced)
  // glyphs, landing it on a different character than the one under the pointer.
  const handleMouseDown = (event: MouseEvent<HTMLInputElement>) => {
    const row = rowRef.current
    if (event.button !== 0 || !row) return
    event.preventDefault()
    const input = event.currentTarget
    const x = event.clientX - row.getBoundingClientRect().left
    const at = Math.max(0, Math.min(input.value.length, Math.round(x / CELL)))
    input.focus()
    input.setSelectionRange(at, at)
    syncSelection()
  }

  const input = (
    <input
      ref={inputRef}
      type={reveal ? 'text' : 'password'}
      className={cx(
        // The input's own text never shows: masked dots and the revealed value
        // are both drawn by the cell overlay (see Dots) so they share one
        // geometry, including the selection wash. Only the placeholder renders
        // from here (15px, muted ink).
        'absolute inset-0 w-full border-0 bg-transparent text-center font-sans text-[15px] tracking-secret text-transparent caret-transparent outline-none selection:bg-transparent placeholder:text-text3',
        lock && 'rounded-xl px-10'
      )}
      placeholder={placeholder || t('Master Password')}
      disabled={inert}
      data-testid={testid}
      autoFocus
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onKeyUp={syncSelection}
      onSelect={syncSelection}
      onMouseDown={handleMouseDown}
      onFocus={() => {
        setFocused(true)
        syncSelection()
      }}
      onBlur={() => setFocused(false)}
    />
  )

  const dots = (
    <Dots
      count={value.length}
      caret={focused && !inert}
      selection={selection}
      rowRef={rowRef}
      text={reveal ? value : undefined}
      busy={pending}
    />
  )

  // The crossed eye alone carries the on state — no persistent wash.
  // Neither string has a catalog entry (pre-existing gap); looked up
  // opportunistically and falls through to the English text below.
  const revealButton = (
    <IconButton
      label={t((reveal ? 'Hide passphrase' : 'Reveal passphrase') as TKey)}
      className={
        lock
          ? 'animate-fade absolute right-1.5 top-1/2 -translate-y-1/2'
          : 'absolute right-0'
      }
      muted={lock}
      onClick={() => setReveal(r => !r)}
    >
      {reveal ? (
        <EyeOffGlyph size={lock ? 15 : 16} />
      ) : (
        <EyeGlyph size={lock ? 15 : 16} />
      )}
    </IconButton>
  )

  if (lock) {
    return (
      <div
        className={cx(
          // In-card icon buttons (reveal, Touch ID) share a softened hover
          // wash; the ! outranks IconButton's own hover:bg-hover, in this one
          // place instead of at every button.
          'relative mx-auto flex h-12 max-w-[380px] items-stretch rounded-xl border bg-detail transition-all duration-300 [&_button:hover]:bg-hover/60!',
          // The inset shadow is the cut; focus goes a touch deeper. It and the
          // state halo (ring) are both box-shadow, so Tailwind composes them.
          'shadow-[var(--lockfield-shadow)] focus-within:shadow-[var(--lockfield-shadow-deep)]',
          bad
            ? 'border-bad/60 ring-4 ring-bad/10 animate-[nudge_420ms_ease_both]'
            : success
              ? 'border-good/50 ring-4 ring-good/15'
              : pending
                ? 'border-accent-line'
                : 'border-text/12 focus-within:border-accent-line focus-within:ring-4 focus-within:ring-accent-soft',
          disabled && 'opacity-60'
        )}
      >
        {/* While verifying, a soft comet of light orbits the border (the
            orbit-ring utility owns the whole effect). */}
        {pending && (
          <span
            aria-hidden
            className="orbit-ring pointer-events-none absolute -inset-px rounded-xl"
          />
        )}
        <div className="relative flex-1">
          {input}
          {dots}
          {/* Reveal is a secondary modifier of what you're typing, so it only
              appears once there is something to reveal, small and dim. */}
          {value.length > 0 && revealButton}
        </div>

        {/* Touch ID is the card's own end segment: a taller divider than the
            reveal tier, and the fingerprint in the macOS Touch ID rose, sized
            to nearly fill the 28px button. */}
        {touchID && (
          <>
            <span aria-hidden className="my-auto h-7 w-px bg-line" />
            <IconButton
              label={t('Touch ID')}
              className="mx-1.5 my-auto"
              onClick={onTouchID}
            >
              {/* Child span so the rose survives IconButton's hover ink. */}
              <span className="text-touchid">
                <FingerprintGlyph size={22} />
              </span>
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
        {dots}
        {revealButton}
      </div>
      <KeyCuts count={value.length} tone={bad ? 'bad' : 'idle'} />
      <Error error={error} />
    </div>
  )
}
