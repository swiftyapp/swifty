import React from 'react'
import classnames from 'classnames'

const Navigation = ({ section, onClick }) => {
  return (
    <ul className="navigation">
      <li
        className={classnames({ current: section === 'vault' })}
        onClick={() => onClick('vault')}
      >
        Vault Settings
      </li>
      <li
        className={classnames({ current: section === 'password' })}
        onClick={() => onClick('password')}
      >
        Password Generation
      </li>
    </ul>
  )
}

export default Navigation
