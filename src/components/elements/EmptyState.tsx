import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import Button from './Button'
import Kbd from './Kbd'
import { MONO_META } from './tokens'

interface Action {
  label: string
  onClick: () => void
  testid?: string
  // For actions that go to the network (a Drive restore) and have to spin.
  loading?: boolean
}

interface Props {
  // A glyph or SVG; the caller picks the size (16 compact, 24–28 in the tile).
  mark: ReactNode
  title: string
  body?: string
  primary?: Action
  secondary?: Action
  hints?: { keys: string; label: string }[]
  // Tint override for the mark tile, e.g. a per-type wash.
  markClassName?: string
  // Ink override for the title, e.g. a quieter tier for a non-hero state.
  titleClassName?: string
  // Single-line variant for a list column: no tile, no title tier.
  compact?: boolean
  // Hook for the surface as a whole — the copy is localised and quoted, so
  // e2e needs something stabler to wait on.
  testid?: string
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
  titleClassName,
  compact,
  testid
}: Props) {
  // A column-width line has no room for buttons, so both actions read as
  // links; the text truncates around them and the line never wraps.
  if (compact)
    return (
      <div
        data-testid={testid}
        className="flex items-center justify-center gap-2 px-3 py-6 text-base text-text3"
      >
        <span className="flex-none">{mark}</span>
        <span className="min-w-0 truncate">{body ?? title}</span>
        {[primary, secondary]
          .filter((action): action is Action => !!action)
          .map(action => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              data-testid={action.testid}
              className="flex-none cursor-pointer text-accent hover:underline"
            >
              {action.label}
            </button>
          ))}
      </div>
    )

  return (
    <div
      data-testid={testid}
      className="flex max-w-xs flex-col items-center gap-5 text-center animate-pop"
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
        <div
          className={cx(
            'text-2xl font-semibold tracking-display',
            titleClassName ?? 'text-text'
          )}
        >
          {title}
        </div>
        {body && <div className="mt-2 text-base text-text2">{body}</div>}

        {(primary || secondary) && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {primary && (
              <Button
                onClick={primary.onClick}
                loading={primary.loading}
                testid={primary.testid}
              >
                {primary.label}
              </Button>
            )}
            {secondary && (
              <Button
                variant="pale"
                onClick={secondary.onClick}
                loading={secondary.loading}
                testid={secondary.testid}
              >
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
                <span className={MONO_META}>{hint.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
