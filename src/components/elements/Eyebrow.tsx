import type { ReactNode } from 'react'

type Tone = 'muted' | 'bad' | 'accent'

interface Props {
  children: ReactNode
  tone?: Tone
  testid?: string
}

// Mono, uppercase, letter-spaced status line. Shared by every auth screen
// (lock / setup / restore) as its eyebrow; the tone alone carries state.
export default function Eyebrow({ children, tone = 'muted', testid }: Props) {
  const text = tone === 'bad' ? 'text-bad' : 'text-text3'

  return (
    <div className="flex items-center justify-center font-mono text-xs uppercase tracking-label">
      <span data-testid={testid} className={text}>
        {children}
      </span>
    </div>
  )
}
