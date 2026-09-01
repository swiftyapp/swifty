import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

type Tone = 'muted' | 'bad' | 'accent'

interface Props {
  children: ReactNode
  tone?: Tone
}

// Mono, uppercase, letter-spaced status line with a slow "breathing" dot.
// Shared by every auth screen (lock / setup / restore) as its eyebrow.
export default function Eyebrow({ children, tone = 'muted' }: Props) {
  const dot =
    tone === 'bad' ? 'bg-bad' : tone === 'accent' ? 'bg-accent' : 'bg-text3'
  const text = tone === 'bad' ? 'text-bad' : 'text-text3'

  return (
    <div className="flex items-center justify-center gap-2.5 font-mono text-xs uppercase tracking-label">
      <span
        className={cx(
          'h-1 w-1 rounded-full animate-[breathe_3.4s_ease-in-out_infinite]',
          dot
        )}
      />
      <span className={text}>{children}</span>
    </div>
  )
}
