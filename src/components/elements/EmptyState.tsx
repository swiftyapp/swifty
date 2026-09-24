import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import Button from './Button'
import Kbd from './Kbd'
import { META } from './tokens'

interface Action {
  label: string
  onClick: () => void
  testid?: string
  // For actions that go to the network (a Drive restore) and have to spin.
  loading?: boolean
}

interface Hint {
  // What to press: a chord ('⌘K'), a key ('⏎'), or the glyph of a control.
  keys: ReactNode
  label: string
}

interface Props {
  // The brand mark, the mascot, or a glyph; the caller picks the size.
  mark: ReactNode
  title: string
  body?: string
  primary?: Action
  secondary?: Action
  hints?: Hint[]
  // Sets the mark in a 64px tinted tile (a per-type wash, an error red). Left
  // out, the mark stands on the pane by itself — the brand mark is its own
  // shape and needs no plate under it.
  markClassName?: string
  // Single-line variant for a list column: no tile, no title tier.
  compact?: boolean
  // Hook for the surface as a whole — the copy is localised and quoted, so
  // e2e needs something stabler to wait on.
  testid?: string
}

// Up to three hints read as one line under the copy; more than that is a
// cheat sheet, and gets ruled off and set in two columns so eight shortcuts
// scan as a table rather than a run-on.
const SHEET_FROM = 4

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

  const sheet = !!hints && hints.length >= SHEET_FROM

  return (
    <div
      data-testid={testid}
      className="flex w-full max-w-xs flex-col items-center gap-6 text-center animate-pop"
    >
      {markClassName ? (
        <div className={cx('grid h-16 w-16 place-items-center rounded-lg', markClassName)}>
          {mark}
        </div>
      ) : (
        mark
      )}

      <div className="w-full">
        <div className="text-2xl font-semibold tracking-display text-text">{title}</div>
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
          <div
            className={cx(
              sheet
                ? 'mt-7 grid grid-cols-2 gap-x-8 gap-y-2 border-t border-line pt-5 text-left'
                : 'mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2'
            )}
          >
            {hints.map(hint => (
              <span
                key={hint.label}
                className={cx(
                  'flex items-center gap-2',
                  // In the sheet the label leads and the key sits flush right,
                  // the way a menu lists its shortcuts; in a line the key leads.
                  sheet && 'flex-row-reverse justify-between'
                )}
              >
                <Kbd>{hint.keys}</Kbd>
                <span className={META}>{hint.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
