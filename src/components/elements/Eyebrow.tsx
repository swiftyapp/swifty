import type { ReactNode } from 'react'
import { LABEL_TYPE } from './tokens'

type Tone = 'muted' | 'bad'

interface Props {
  children: ReactNode
  tone?: Tone
  // Something is in flight: a light band shimmers through the text.
  busy?: boolean
  testid?: string
}

// Small, uppercase, letter-spaced status line. Shared by every auth screen
// (lock / setup / restore) as its eyebrow; the tone alone carries state.
export default function Eyebrow({
  children,
  tone = 'muted',
  busy,
  testid
}: Props) {
  const text = tone === 'bad' ? 'text-bad' : 'text-text3'

  return (
    <div className={`flex items-center justify-center ${LABEL_TYPE}`}>
      {/* The shimmer gradient IS the ink — the solid ink class would paint
          over it (color beats background-clip), so they're exclusive. */}
      <span data-testid={testid} className={busy ? 'shimmer-text' : text}>
        {children}
      </span>
    </div>
  )
}
