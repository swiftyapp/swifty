import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import RailButton from '@/components/elements/RailButton'
import { TagsRailGlyph } from '../../icons'
import Menu from './Menu'

// The rail's one filter tile. A tag narrows whatever view is open rather than
// replacing it, so the tile is lit by an active tag — not by an open menu:
// what it reports is that the list in front of you is being narrowed.
export default function Tags({ className, menu }: { className?: string; menu?: string }) {
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
        className={className}
      >
        <TagsRailGlyph />
      </RailButton>
      {/* `menu` is where the dropdown hangs — the rail's side by default, and
          wherever the tile ended up otherwise. */}
      {open && <Menu onClose={() => setOpen(false)} className={menu} />}
    </div>
  )
}
