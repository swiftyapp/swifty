import type { ReactNode } from 'react'
import Eyebrow from '@/components/elements/Eyebrow'
import Mascot from '@/components/elements/Mascot'

interface Props {
  /** The micro status line: which step this is, or what went wrong. */
  eyebrow: ReactNode
  tone?: 'muted' | 'warn' | 'bad'
  /** Something is in flight: the eyebrow shimmers instead of sitting still. */
  busy?: boolean
  title: string
  body?: ReactNode
  /**
   * What sits above the header. The mascot by default — it walks the whole
   * first run with the user, as it does the lock screen — and a screen with
   * its own emblem (the biometric question's gate) passes that instead.
   */
  mark?: ReactNode
  /**
   * How far along the first run this screen is, 0 .. 1: the mascot's eyes
   * brighten a notch per step (see Mascot's `joy`). The welcome leaves it at 0.
   */
  progress?: number
}

// Mark, eyebrow, headline and lead paragraph — the top of every first-run
// screen, in the type the auth screens have always used (see the lock/setup
// headings). Set tight, as one block: the eyebrow captions the headline rather
// than floating above it, and the lead is a line or two, never a paragraph.
export default function StepHeader({
  eyebrow,
  tone,
  busy,
  title,
  body,
  mark,
  progress = 0
}: Props) {
  // The mascot reads the room: it concentrates while something is in flight
  // and shakes its head at a failure, the same cues it gives on the lock screen.
  const state = tone === 'bad' ? 'error' : busy ? 'checking' : 'idle'

  return (
    <>
      <div className="mb-6 flex justify-center">
        {mark ?? <Mascot state={state} joy={progress} />}
      </div>
      <Eyebrow tone={tone} busy={busy}>
        {eyebrow}
      </Eyebrow>
      <h1 className="mt-2.5 text-center text-2xl font-medium tracking-display text-text">
        {title}
      </h1>
      {body && (
        <p className="mx-auto mt-2 max-w-md text-center text-base leading-relaxed text-text2">
          {body}
        </p>
      )}
    </>
  )
}
