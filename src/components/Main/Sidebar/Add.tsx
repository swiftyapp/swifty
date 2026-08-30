import { useAppDispatch, useAppSelector } from '@/store'
import { newEntry } from '@/store/entriesSlice'
import { setFilterScope } from '@/store/filtersSlice'
import Plus from '@/assets/images/plus.svg?react'

export default function Add() {
  const dispatch = useAppDispatch()
  const scope = useAppSelector(state => state.filters.scope)

  const onAddEntry = () => {
    if (scope === 'audit') dispatch(setFilterScope('login'))
    dispatch(newEntry())
  }

  return (
    <div className="add-button" onClick={onAddEntry}>
      <Plus />
    </div>
  )
}
