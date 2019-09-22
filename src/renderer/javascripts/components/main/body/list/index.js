import React from 'react'
import AuditList from './audit'
import ManagerList from './manager'
import { useSelector } from 'react-redux'

export default () => {
  const scope = useSelector(state => state.filters.scope)
  return scope === 'audit' ? <AuditList /> : <ManagerList />
}
