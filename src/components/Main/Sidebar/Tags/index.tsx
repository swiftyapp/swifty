import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import RailButton from '@/components/elements/RailButton'
import { TagsRailGlyph } from '../../icons'
import Menu from './Menu'

// The Tags tile: a view of the rail like the three above it, reached through
// its menu — the tile opens the list of tags, and picking one lands in the
// Tags view with that tag's items. So it is lit like any view tile, by the
// view being open, not by the menu.
export default function Tags({ className, menu }: { className?: string; menu?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = useStore(state => state.ui.view === 'tags')

  return (
    <div className="relative flex-none">
      <RailButton
        label={t('Tags')}
        selected={selected}
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
