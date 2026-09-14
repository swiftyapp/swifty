import type { ReactNode } from 'react'
import Eyebrow from '@/components/elements/Eyebrow'

interface Props {
  /** The micro status line: which step this is, or what went wrong. */
  eyebrow: ReactNode
  tone?: 'muted' | 'warn' | 'bad'
  /** Something is in flight: the eyebrow shimmers instead of sitting still. */
  busy?: boolean
  title: string
  body?: ReactNode
}

// Eyebrow, headline and lead paragraph — the top of every first-run screen, in
// the type the auth screens have always used (see the lock/setup headings).
export default function StepHeader({ eyebrow, tone, busy, title, body }: Props) {
  return (
    <>
      <Eyebrow tone={tone} busy={busy}>
        {eyebrow}
      </Eyebrow>
      <h1 className="mt-8 text-center text-2xl font-medium tracking-display text-text">
        {title}
      </h1>
      {body && (
        <p className="mx-auto mt-3 max-w-md text-center text-base leading-relaxed text-text2">
          {body}
        </p>
      )}
    </>
  )
}
