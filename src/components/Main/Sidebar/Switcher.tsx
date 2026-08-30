import { cx } from '@/utils/cx'
import { useAppDispatch, useAppSelector } from '@/store'
import { setFilterScope, type Scope } from '@/store/filtersSlice'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'
import LoginIcon from '@/assets/images/login.svg?react'
import CardIcon from '@/assets/images/card.svg?react'
import NoteIcon from '@/assets/images/note.svg?react'

export default function Switcher() {
  const dispatch = useAppDispatch()
  const scope = useAppSelector(state => state.filters.scope)

  const itemClass = (current: Scope) =>
    cx('item', { current: scope === current })

  return (
    <div className="switcher">
      <Tooltip content={t('Logins')}>
        <div className={itemClass('login')} onClick={() => dispatch(setFilterScope('login'))}>
          <LoginIcon width="28" height="28" />
        </div>
      </Tooltip>
      <Tooltip content={t('Secure Notes')}>
        <div className={itemClass('note')} onClick={() => dispatch(setFilterScope('note'))}>
          <NoteIcon width="28" height="28" />
        </div>
      </Tooltip>
      <Tooltip content={t('Credit Cards')}>
        <div className={itemClass('card')} onClick={() => dispatch(setFilterScope('card'))}>
          <CardIcon width="28" height="28" />
        </div>
      </Tooltip>
    </div>
  )
}
