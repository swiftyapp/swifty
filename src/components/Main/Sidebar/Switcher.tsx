import { cx } from '@/utils/cx'
import { useStore, setFilterScope } from '@/store'
import { type Scope } from '@/store/filtersSlice'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'
import LoginIcon from '@/assets/images/login.svg?react'
import CardIcon from '@/assets/images/card.svg?react'
import NoteIcon from '@/assets/images/note.svg?react'

export default function Switcher() {
  const scope = useStore(state => state.filters.scope)

  const itemClass = (current: Scope) =>
    cx('item', { current: scope === current })

  return (
    <div className="switcher">
      <Tooltip content={t('Logins')}>
        <div className={itemClass('login')} onClick={() => setFilterScope('login')}>
          <LoginIcon width="28" height="28" />
        </div>
      </Tooltip>
      <Tooltip content={t('Secure Notes')}>
        <div className={itemClass('note')} onClick={() => setFilterScope('note')}>
          <NoteIcon width="28" height="28" />
        </div>
      </Tooltip>
      <Tooltip content={t('Credit Cards')}>
        <div className={itemClass('card')} onClick={() => setFilterScope('card')}>
          <CardIcon width="28" height="28" />
        </div>
      </Tooltip>
    </div>
  )
}
