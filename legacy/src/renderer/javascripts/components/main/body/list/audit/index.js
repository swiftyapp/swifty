import React from 'react'
import Loading from './loading'
import Weak from './weak'
import Short from './short'
import Duplicate from './duplicate'
import Old from './old'
import Empty from '../empty'
import { useSelector } from 'react-redux'

const AuditList = () => {
  const { entries, audit } = useSelector(state => ({
    audit: state.audit,
    entries: state.entries.items
  }))

  const filter = (entries, audit, property) => {
    return Object.keys(audit)
      .map(key => {
        if (audit[key][property]) return entries.find(entry => entry.id === key)
        return null
      })
      .filter(item => item !== null)
  }

  if (!audit) return <Loading />
  if (Object.keys(audit).length === 0) return <Empty />

  return (
    <div className="list">
      <Weak entries={filter(entries, audit, 'isWeak')} />
      <Short entries={filter(entries, audit, 'isShort')} />
      <Duplicate entries={filter(entries, audit, 'isRepeating')} />
      <Old entries={filter(entries, audit, 'isOld')} />
    </div>
  )
}

export default AuditList
