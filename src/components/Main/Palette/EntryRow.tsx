import type { EntryMeta } from '@/lib/commands'
import { kindOf } from '@/kinds'
import { t } from '@/i18n'
import Kbd from '@/components/elements/Kbd'
import Row from './Row'

interface Props {
  entry: EntryMeta
  focused: boolean
  onOpen: () => void
  onHover: () => void
}

export default function EntryRow({ entry, focused, onOpen, onHover }: Props) {
  const kind = kindOf(entry.type)
  const Glyph = kind.Glyph
  // The same secondary line the list column shows for this kind.
  const sub = kind.listSubtitle(entry)

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
