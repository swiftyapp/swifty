import { cx } from '@/utils/cx'
import { useStore, setFilterScope } from '@/store'
import { type Scope } from '@/store/filtersSlice'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'
import { LoginGlyph, NoteGlyph, CardGlyph } from '../icons'

// Scope filters as rail icon buttons. Order (login, note, card) and the
// `.switcher`/`.item` class hooks are relied on by unit tests.
const scopes: { scope: Scope; label: string; Icon: typeof LoginGlyph }[] = [
  { scope: 'login', label: 'Logins', Icon: LoginGlyph },
  { scope: 'note', label: 'Secure Notes', Icon: NoteGlyph },
  { scope: 'card', label: 'Credit Cards', Icon: CardGlyph }
]

export default function Switcher() {
  const scope = useStore(state => state.filters.scope)

  return (
    <div className="switcher flex flex-col items-center gap-2">
      {scopes.map(({ scope: current, label, Icon }) => {
        const selected = scope === current
        return (
          <Tooltip content={t(label)} key={current}>
            <div
              className={cx(
                'item relative grid h-10 w-10 cursor-pointer place-items-center rounded-lg transition-colors',
                selected
                  ? 'current bg-tile text-text'
                  : 'text-text2 hover:bg-hover hover:text-text'
              )}
              onClick={() => setFilterScope(current)}
            >
              {selected && (
                <span className="absolute -left-3.5 top-3 h-4 w-0.5 rounded-full bg-accent" />
              )}
              <Icon size={18} />
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}
