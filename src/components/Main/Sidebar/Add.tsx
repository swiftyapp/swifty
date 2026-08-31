import { useStore, newEntry, setFilterScope } from '@/store'
import Plus from '@/assets/images/plus.svg?react'

export default function Add() {
  const scope = useStore(state => state.filters.scope)

  const onAddEntry = () => {
    if (scope === 'audit') setFilterScope('login')
    newEntry()
  }

  return (
    <div className="add-button" onClick={onAddEntry}>
      <Plus />
    </div>
  )
}
