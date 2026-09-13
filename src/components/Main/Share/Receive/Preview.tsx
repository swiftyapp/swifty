import { useTranslation } from 'react-i18next'
import type { Entry } from '@/lib/commands'
import type { TKey } from '@/i18n'
import { kindOf } from '@/kinds'
import { secretFieldCount } from '@/kinds/secrets'

/**
 * The fields worth showing to answer "is this the thing I was sent?" — an
 * account name, a site, a file. Never a secret: the preview is shown before the
 * user has committed to keeping any of this, and a value on screen is a value
 * over the shoulder of whoever is standing behind them.
 */
const identifiers = (entry: Entry): { label: TKey; value: string }[] => {
  const fields = entry as unknown as Record<string, string | undefined>
  return (
    [
      { label: 'Username', value: fields.username },
      { label: 'Email', value: fields.email },
      { label: 'Website', value: fields.website },
      // Only the card's: an identity's `name` is the holder's, which is the
      // document's most identifying line rather than a label for a row.
      { label: 'Cardholder', value: entry.type === 'card' ? fields.name : undefined },
      { label: 'File', value: fields.fileName }
    ] as { label: TKey; value: string | undefined }[]
  ).filter((row): row is { label: TKey; value: string } => !!row.value)
}

export default function Preview({ entry }: { entry: Entry }) {
  const { t } = useTranslation()
  const kind = kindOf(entry.type)
  const secrets = secretFieldCount(entry)

  return (
    <div data-testid="share-preview" className="mt-5 rounded-lg border border-line bg-tile p-4">
      <div className="flex items-center gap-2 text-base text-text3">
        <kind.Glyph className="flex-none" />
        <span>{t(kind.label)}</span>
      </div>
      <div data-testid="share-preview-title" className="mt-1 text-lg font-semibold text-text">
        {entry.title || t(kind.untitledLabel)}
      </div>

      {identifiers(entry).map(row => (
        <div key={row.label} className="mt-2 flex items-baseline gap-3 text-base">
          <span className="w-24 flex-none text-text3">{t(row.label)}</span>
          <span className="min-w-0 flex-1 truncate text-text2">{row.value}</span>
        </div>
      ))}

      {secrets > 0 && (
        <div data-testid="share-preview-secrets" className="mt-3 text-base text-text3">
          {t('{{count}} secret field included', { count: secrets })}
        </div>
      )}
    </div>
  )
}
