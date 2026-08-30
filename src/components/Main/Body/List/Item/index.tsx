import { cx } from '@/utils/cx'
import { useAppDispatch, useAppSelector } from '@/store'
import { setCurrentEntry } from '@/store/entriesSlice'
import type { Entry } from '@/lib/commands'
import Login from './Login'
import Card from './Card'
import Note from './Note'

interface Props {
  entry: Entry
}

export default function Item({ entry }: Props) {
  const dispatch = useAppDispatch()
  const current = useAppSelector(state => state.entries.current)

  const content = () => {
    switch (entry.type) {
      case 'login':
        return <Login entry={entry} />
      case 'card':
        return <Card entry={entry} />
      case 'note':
        return <Note entry={entry} />
    }
  }

  return (
    <div
      className={cx('entry', { current: current?.id === entry.id })}
      onClick={() => dispatch(setCurrentEntry(entry.id))}
    >
      {content()}
    </div>
  )
}
