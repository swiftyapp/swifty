import { useState } from 'react'
import { deleteEntry } from '@/store'
import type { Entry, EntryMeta } from '@/lib/commands'
import { useFavicon } from '@/hooks/useFavicon'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { FieldsProvider } from '@/components/elements/fields'
import { MONO_LABEL } from '@/components/elements/tokens'
import { hasBrandMark } from '@/utils/cardBrand'
import { kindOf } from '@/kinds'
import { relativeTime } from '@/utils/time'
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

  const stamps = [
    entry.deletedAt && t('Deleted {{time}}', { time: relativeTime(entry.deletedAt) }),
    t('Modified {{time}}', { time: relativeTime(entry.updatedAt) }),
    t('Created {{time}}', { time: relativeTime(entry.createdAt) })
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 whitespace-nowrap ${MONO_LABEL}`}>
            <span className="text-text2">{t(kind.label)}</span>
            {entry.urlHost && (
              <>
                <span>/</span>
                <span>{entry.urlHost}</span>
              </>
            )}
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
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {/* A tombstone cannot be starred — Favorites lists live entries. */}
          {!entry.deletedAt && <Favorite entry={entry} />}
          <Actions entry={entry} revealed={revealed} onDelete={onDelete} />
        </div>
      </div>

      {revealed && (
        <div className="mt-3">
          {/* No writer: every field in the set renders its read face. */}
          <FieldsProvider value={{ entry: { ...revealed }, set: null, attempted: false }}>
            <Fields />
          </FieldsProvider>
        </div>
      )}

      <div data-testid="entry-stamps" className={`mt-5 ${MONO_LABEL}`}>
        {stamps}
      </div>

      {deleteError && (
        <div className="mt-3 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad">
          {deleteError}
        </div>
      )}
    </div>
  )
}
