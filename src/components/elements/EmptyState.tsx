import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import Button from './Button'
import Kbd from './Kbd'

interface Action {
  label: string
  onClick: () => void
  testid?: string
}

interface Props {
  // A glyph or SVG; the caller picks the size (16 compact, 24–28 in the tile).
  mark: ReactNode
  title: string
  body?: string
  primary?: Action
  secondary?: { label: string; onClick: () => void }
  hints?: { keys: string; label: string }[]
  // Tint override for the mark tile, e.g. a per-type wash.
  markClassName?: string
  // Single-line variant for a list column: no tile, no title tier.
  compact?: boolean
  className?: string
}

// THE nothing-here surface: one mark, one title, one line, one action. Every
// empty list, filtered result and unconfigured panel uses it so "empty" reads
// the same everywhere.
export default function EmptyState({
  mark,
  title,
  body,
  primary,
  secondary,
  hints,
  markClassName,
  compact,
  className
}: Props) {
  if (compact)
    return (
      <div
        className={cx(
          'flex items-center justify-center gap-2 px-3 py-6 text-base text-text3',
          className
        )}
      >
        <span className="flex-none">{mark}</span>
        <span className="min-w-0 truncate">{body ?? title}</span>
        {secondary && (
          <button
            type="button"
            onClick={secondary.onClick}
            className="flex-none cursor-pointer text-accent hover:underline"
          >
            {secondary.label}
          </button>
        )}
      </div>
    )

  return (
    <div
      className={cx(
        'flex max-w-[320px] flex-col items-center gap-5 text-center animate-pop',
        className
      )}
    >
      <div
        className={cx(
          'grid h-16 w-16 place-items-center rounded-lg',
          markClassName ?? 'bg-accent-soft text-accent'
        )}
      >
        {mark}
      </div>

      <div>
        <div className="text-2xl font-semibold tracking-display text-text">{title}</div>
        {body && <div className="mt-2 text-base text-text2">{body}</div>}

        {(primary || secondary) && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {primary && (
              <Button onClick={primary.onClick} testid={primary.testid}>
                {primary.label}
              </Button>
            )}
            {secondary && (
              <Button variant="pale" onClick={secondary.onClick}>
                {secondary.label}
              </Button>
            )}
          </div>
        )}

        {hints && hints.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            {hints.map(hint => (
              <span key={hint.keys} className="flex items-center gap-1.5">
                <Kbd>{hint.keys}</Kbd>
                <span className="font-mono text-xs text-text3">{hint.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
