import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import type { TKey } from '@/i18n'
import type { ImportFormat } from '@/lib/commands'
import { CARD, MONO_META } from '@/components/elements/tokens'

// One tile per source. `format` absent means the Swifty backup tile, which goes
// through its own picker and password.
const TILES: {
  key: string
  badge: string
  name: TKey
  hint: TKey
  format?: ImportFormat
}[] = [
  { key: 'bitwarden', badge: 'BW', name: 'Bitwarden', hint: '.json export', format: 'bitwarden' },
  {
    key: 'cxf',
    badge: 'CXF',
    name: 'FIDO Credential Exchange (CXF)',
    hint: '.json export',
    format: 'cxf'
  },
  { key: 'chrome', badge: 'CH', name: 'Chrome / Safari', hint: '.csv export', format: 'chrome' },
  { key: 'lastpass', badge: 'LP', name: 'LastPass', hint: '.csv export', format: 'lastpass' },
  { key: 'keepass', badge: 'KP', name: 'KeePass', hint: '.csv export', format: 'keepass' },
  { key: 'csv', badge: 'CSV', name: 'Generic CSV', hint: '.csv export', format: 'csv' },
  { key: 'swftx', badge: 'SW', name: 'Backup file (.swftx)', hint: '.swftx backup' }
]

interface Props {
  active: string | null
  disabled: boolean
  onFormat: (format: ImportFormat) => void
  onBackup: () => void
}

export default function Tiles({ active, disabled, onFormat, onBackup }: Props) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-3 gap-3">
      {TILES.map(tile => (
        <button
          key={tile.key}
          type="button"
          disabled={disabled}
          data-testid={`import-tile-${tile.key}`}
          onClick={() => (tile.format ? onFormat(tile.format) : onBackup())}
          className={cx(
            CARD,
            'cursor-pointer p-4 text-left transition-colors hover:border-accent-line',
            active === tile.key && 'border-accent-line',
            disabled && 'cursor-default opacity-50'
          )}
        >
          <div className="grid h-10 w-10 place-items-center rounded-sm bg-tile font-mono text-xs text-text2">
            {tile.badge}
          </div>
          <div className="mt-3 truncate text-base text-text">{t(tile.name)}</div>
          <div className={`mt-0.5 ${MONO_META}`}>{t(tile.hint)}</div>
        </button>
      ))}
    </div>
  )
}
