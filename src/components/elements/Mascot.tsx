import { memo } from 'react'

export type MascotState = 'idle' | 'typing' | 'checking' | 'success' | 'error'

interface Props {
  state?: MascotState
  // Where the eyes look horizontally, -1 (left) .. 1 (right). The lock screen
  // maps the passphrase caret position onto this so the mascot reads along.
  gaze?: number
  // Body color. Graphite by default; a vault-personalization setting will feed
  // this eventually.
  color?: string
  size?: number
}

const GRAPHITE = '#34373e'

// One flared spike: narrow at the base, wide at the tip, soft outer corners.
// Rotated around the hub; the circle buries the bases.
const SPIKE = 'M26 24 L24 7 Q23.5 3 27.5 3 L36.5 3 Q40.5 3 40 7 L38 24 Z'
const SPIKE_ANGLES = [0, 60, 120, 180, 240, 300]

// The Swifty mascot: the brand asterisk (a secret value, redacted) with eyes.
// It sits still and blinks every once in a while, follows typing with its
// gaze, cheers when the vault opens and shakes its head at a bad passphrase.
// Memoized: the filtered SVG is the priciest thing on the lock screen, and
// most parent re-renders (keystrokes past the gaze sweep) don't change it.
function Mascot({
  state = 'idle',
  gaze = 0,
  color = GRAPHITE,
  size = 96
}: Props) {
  const ok = state === 'success'
  const bad = state === 'error'
  const typing = state === 'typing'
  // Verifying the passphrase: eyes narrow in concentration, gaze straight.
  const checking = state === 'checking'

  // Graphite (or the configured color) while idle and typing; the body only
  // tints for the verdict, then the eye shapes carry the expression.
  const fill = ok ? 'var(--c-good)' : bad ? 'var(--c-bad)' : color
  const bodyAnim = ok
    ? 'animate-[cheer_780ms_cubic-bezier(0.2,0.8,0.2,1)_both]'
    : bad
      ? 'animate-[deny_540ms_ease_both]'
      : undefined

  // Eyes track the caret while typing, dip slightly toward the field, and
  // snap back to center for a reaction or while concentrating.
  const gazeX = ok || bad || checking ? 0 : Math.max(-1, Math.min(1, gaze)) * 3
  const gazeY = checking ? 1.5 : typing ? 2.5 : 0
  const eyeRy = checking ? 3 : typing ? 4.3 : 5

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      data-testid="lock-mascot"
      data-state={state}
      className={bodyAnim}
    >
      <defs>
        {/* Blur + alpha threshold rounds every corner of the body's combined
            silhouette — including the concave notch bottoms, which per-shape
            stroke joins cannot fillet. */}
        <filter id="mascot-soften" x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -13"
          />
        </filter>
      </defs>
      <g
        filter="url(#mascot-soften)"
        style={{ fill, transition: 'fill 300ms ease' }}
      >
        {SPIKE_ANGLES.map(angle => (
          <path
            key={angle}
            d={SPIKE}
            transform={angle ? `rotate(${angle} 32 32)` : undefined}
          />
        ))}
        <circle cx="32" cy="32" r="14" />
      </g>

      <g
        style={{
          transform: `translate(${gazeX}px, ${gazeY}px)`,
          transition: 'transform 500ms cubic-bezier(0.2, 0.85, 0.25, 1)'
        }}
      >
        <g
          style={{ transformOrigin: '32px 27px' }}
          className={
            ok || bad ? undefined : 'animate-[blink_6.8s_ease-in-out_infinite]'
          }
        >
          {/* Open eyes (idle / typing) */}
          <g
            style={{ opacity: ok || bad ? 0 : 1, transition: 'opacity 190ms ease' }}
          >
            <ellipse
              cx="27.6"
              cy="27.4"
              rx="3.5"
              ry={eyeRy}
              fill="#fff"
              style={{ transition: 'ry 300ms ease' }}
            />
            <ellipse
              cx="37.2"
              cy="26.8"
              rx="3.5"
              ry={eyeRy}
              fill="#fff"
              style={{ transition: 'ry 300ms ease' }}
            />
          </g>
          {/* Happy arcs (success) */}
          <g
            style={{ opacity: ok ? 1 : 0, transition: 'opacity 190ms ease' }}
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M24.4 28.4c1.2-2.9 5.2-2.9 6.4 0" />
            <path d="M34 27.8c1.2-2.9 5.2-2.9 6.4 0" />
          </g>
          {/* Sad arcs (error) */}
          <g
            style={{ opacity: bad ? 1 : 0, transition: 'opacity 190ms ease' }}
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M24.4 26.2c1.2 2.9 5.2 2.9 6.4 0" />
            <path d="M34 25.6c1.2 2.9 5.2 2.9 6.4 0" />
          </g>
        </g>
      </g>
    </svg>
  )
}

export default memo(Mascot)
