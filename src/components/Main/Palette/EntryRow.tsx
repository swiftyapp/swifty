import type { EntryMeta } from '@/lib/commands'
import { t } from '@/i18n'
import Kbd from '@/components/elements/Kbd'
import { CardGlyph, LoginGlyph, NoteGlyph } from '../icons'
import Row from './Row'

interface Props {
  entry: EntryMeta
  focused: boolean
  onOpen: () => void
  onHover: () => void
}

const GLYPH = {
  login: LoginGlyph,
  card: CardGlyph,
  note: NoteGlyph
} as const

// Same secondary line as the list column: the site host for a login, a masked
// pattern for a card (the real number is a secret), tags otherwise.
const subtitle = (entry: EntryMeta): string => {
  if (entry.type === 'card') return '•••• •••• •••• ••••'
  if (entry.type === 'login' && entry.urlHost) return entry.urlHost
  return entry.tags.join(' · ')
}

export default function EntryRow({ entry, focused, onOpen, onHover }: Props) {
  const Glyph = GLYPH[entry.type]
  const sub = subtitle(entry)

  return (
    <Row focused={focused} onClick={onOpen} onHover={onHover} className="rounded-lg p-2.5">
      <div className="grid h-7 w-7 flex-none place-items-center rounded-sm bg-tile text-text2">
        <Glyph size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-medium text-text">{entry.title}</div>
        {sub && <div className="mt-[3px] truncate font-mono text-xs text-text3">{sub}</div>}
      </div>
      {focused && (
        <div className="flex flex-none gap-[5px]">
          <Kbd>⏎ {t('open')}</Kbd>
          <Kbd>⌘⏎ {t('copy')}</Kbd>
        </div>
      )}
    </Row>
  )
}
