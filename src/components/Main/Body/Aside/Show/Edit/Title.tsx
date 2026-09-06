import { useTranslation } from 'react-i18next'
import type { Kind } from '@/kinds'
import { cx } from '@/utils/cx'
import type { Draft } from './useDraft'

interface Props {
  draft: Draft
  /** The kind being written — its glyph and its "Untitled …" placeholder. */
  kind: Kind
  /** The tile's box — 28px in the desktop pane, 44px on the phone. */
  tile: string
  /** The mark inside it, in px. Scales with the tile; nothing else does. */
  glyph: number
  /** The row the tile and the input sit on. */
  className?: string
  /** The indent that lines the Required message up under the input. */
  message?: string
}

// What the entry is called, and what kind it is: the accent tile beside a title
// you can type in. Both shells draw the same pair, only bigger where there is
// room — so the sizes arrive as classes rather than as a shell to ask about.
export default function Title({ draft, kind, tile, glyph, className, message }: Props) {
  const { t } = useTranslation()
  const Glyph = kind.Glyph
  const title = typeof draft.model.title === 'string' ? draft.model.title : ''

  return (
    <>
      <div className={className}>
        <div
          className={cx(
            'grid',
            tile,
            'flex-none place-items-center rounded-lg bg-accent-soft text-accent'
          )}
        >
          <Glyph size={glyph} />
        </div>
        <input
          name="title"
          value={title}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          placeholder={t(kind.untitledLabel)}
          onChange={event => draft.set('title', event.target.value)}
          className="min-w-0 flex-1 truncate border-b border-line2 bg-transparent text-2xl font-semibold tracking-display text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line"
        />
      </div>
      {/* Every kind requires a title, so the editor owns this one message. */}
      {draft.attempted && !title.trim() && (
        <div className={cx('mt-1.5', message, 'text-base text-bad')}>{t('Required')}</div>
      )}
    </>
  )
}
