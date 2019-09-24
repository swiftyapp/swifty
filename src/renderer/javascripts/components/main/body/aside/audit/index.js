import React from 'react'
import Score from './score'
import { useSelector } from 'react-redux'

export default () => {
  const { isPristine, audit } = useSelector(state => ({
    audit: state.audit,
    isPristine: state.entries.items.length === 0
  }))

  if (isPristine || !audit) return null

  let shortIds = [],
    weakIds = [],
    oldIds = [],
    duplicateIds = []

  Object.keys(audit).forEach(key => {
    if (audit[key].isShort) shortIds.push(key)
    if (audit[key].isWeak) weakIds.push(key)
    if (audit[key].isOld) oldIds.push(key)
    if (audit[key].isRepeating) duplicateIds.push(key)
  })

  return (
    <div className="aside">
      <div className="audit">
        <Score audit={audit} />
        <h3>Password Audit</h3>
        <ul className="stats">
          <li>
            <span className="marker level-one"></span>
            Weak <span className="count">{weakIds.length}</span>
          </li>
          <li>
            <span className="marker level-two"></span>
            Too Short <span className="count">{shortIds.length}</span>
          </li>
          <li>
            <span className="marker level-three"></span>
            Duplicates <span className="count">{duplicateIds.length}</span>
          </li>
          <li>
            <span className="marker level-four"></span>
            More than 6 month old<span className="count">{oldIds.length}</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
