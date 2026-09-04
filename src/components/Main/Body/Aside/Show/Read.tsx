import { Fragment, useState } from 'react'
import { deleteEntry } from '@/store'
import type { Entry, EntryMeta } from '@/lib/commands'
import type { TKey } from '@/i18n'
import { useFavicon } from '@/hooks/useFavicon'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { FieldsProvider } from '@/components/elements/fields'
import { MONO_LABEL } from '@/components/elements/tokens'
import { hasBrandMark } from '@/utils/cardBrand'
import { kindOf } from '@/kinds'
import { dateTime, relativeLong } from '@/utils/time'
import { useTranslation } from 'react-i18next'
import Actions from './Actions'
import Favorite from './Favorite'

interface Props {
  entry: EntryMeta
  /** The decrypted entry, or null while `revealEntry` is still in flight. */
  revealed: Entry | null
}

export default function Read({ entry, revealed }: Props) {
  const { t } = useTranslation()
  const icon = useFavicon(entry.urlHost)
  const kind = kindOf(entry.type)
  const Glyph = kind.Glyph
  const Fields = kind.Fields
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const onDelete = () => {
    setDeleteError(null)
    deleteEntry(entry.id).catch(() =>
      setDeleteError(t('Could not delete. Please try again.'))
    )
  }

  // The eyebrow's second half: whatever the kind can say about this entry —
  // an identity's document type, once the payload is in hand — and the host
  // otherwise, which is metadata and needs no reveal.
  const fromKind = revealed ? kind.eyebrow?.(revealed) : null
  const segment: { text: string; testid?: string } | null =
    fromKind ?? (entry.urlHost ? { text: entry.urlHost } : null)

  // Metadata sentences, not labels: long-form relative times, and the absolute
  // one a hover away.
  const stamps = (
    [
      ['Deleted {{time}}', entry.deletedAt],
      ['Modified {{time}}', entry.updatedAt],
      ['Created {{time}}', entry.createdAt]
    ] as [TKey, string | undefined][]
  ).filter(([, iso]) => iso)

  return (
    <div className="mx-auto w-full max-w-[860px]">
      {/* The eyebrow shares its line with the actions, so the title below can
          run the full content width. */}
      <div className="flex items-center justify-between gap-4">
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 truncate whitespace-nowrap ${MONO_LABEL}`}
        >
          <span className="text-text2">{t(kind.label)}</span>
          {/* What the entry is, once it can say so: the host it belongs to, or
              — for a document, whose type is encrypted — what kind it is. */}
          {segment && (
            <>
              <span>·</span>
              <span data-testid={segment.testid}>{segment.text}</span>
            </>
          )}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {/* A tombstone cannot be starred — Favorites lists live entries. */}
          {!entry.deletedAt && <Favorite entry={entry} />}
          <Actions entry={entry} revealed={revealed} onDelete={onDelete} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <div className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-lg bg-tile text-text2">
          {icon ? (
            <img src={icon} alt="" className="h-full w-full object-cover" />
          ) : hasBrandMark(entry.cardBrand) ? (
            <CardBrandMark brand={entry.cardBrand} size={12} />
          ) : (
            <Glyph size={16} />
          )}
        </div>
        <h1 className="truncate text-2xl font-semibold tracking-display text-text">
          {entry.title}
        </h1>
      </div>

      {revealed && (
        <div className="mt-5">
          {/* No writer: every field in the set renders its read face. */}
          <FieldsProvider value={{ entry: { ...revealed }, set: null, attempted: false }}>
            <Fields />
          </FieldsProvider>
        </div>
      )}

      <div data-testid="entry-stamps" className="mt-4 font-mono text-xs text-text3">
        {stamps.map(([key, iso], index) => (
          <Fragment key={key}>
            {index > 0 && ' · '}
            <span title={dateTime(iso)}>{t(key, { time: relativeLong(iso) })}</span>
          </Fragment>
        ))}
      </div>

      {deleteError && (
        <div className="mt-3 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad">
          {deleteError}
        </div>
      )}
    </div>
  )
}
