import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import RailButton from '@/components/elements/RailButton'
import { TagsRailGlyph } from '../../icons'
import Menu from './Menu'

// The rail's one filter tile. A tag narrows whatever view is open rather than
// replacing it, so the tile is lit by an active tag — not by an open menu:
// what it reports is that the list in front of you is being narrowed.
export default function Tags({ compact }: { compact?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const tag = useStore(state => state.filters.tag)

  return (
    <div className="relative flex-none">
      <RailButton
        label={t('Tags')}
        selected={tag !== null}
        onClick={() => setOpen(value => !value)}
        testid="tags-button"
        className={compact ? 'h-11 w-11' : undefined}
      >
        <TagsRailGlyph />
      </RailButton>
      {/* Compact hangs the tile off the list header instead of the rail, so the
          menu drops below the trigger rather than out to its side. */}
      {open && (
        <Menu
          onClose={() => setOpen(false)}
          className={compact ? 'right-0 top-full mt-2' : 'left-full top-0 ml-3'}
        />
      )}
    </div>
  )
}
