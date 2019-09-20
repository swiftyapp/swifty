import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

export default () => {
  const dispatch = useDispatch()
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

  const onClick = ids => {
    dispatch({ type: 'SET_FILTER_IDS', ids })
  }

  return (
    <>
      <h3>Password Audit</h3>
      <div className="audit">
        <ul className="stats">
          <li onClick={() => onClick(weakIds)}>
            <span className="marker level-one"></span>
            Weak <span className="count">{weakIds.length}</span>
          </li>
          <li onClick={() => onClick(shortIds)}>
            <span className="marker level-two"></span>
            Too Short <span className="count">{shortIds.length}</span>
          </li>
          <li onClick={() => onClick(duplicateIds)}>
            <span className="marker level-three"></span>
            Duplicates <span className="count">{duplicateIds.length}</span>
          </li>
          <li onClick={() => onClick(oldIds)}>
            <span className="marker level-four"></span>
            More than 6 month old<span className="count">{oldIds.length}</span>
          </li>
        </ul>
      </div>
    </>
  )
}
