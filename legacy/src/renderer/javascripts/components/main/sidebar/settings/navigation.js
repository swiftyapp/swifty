import React from 'react'
import classnames from 'classnames'

const Navigation = ({ section, onClick }) => {
  const { i18n } = window
  return (
    <ul className="navigation">
      <li
        className={classnames({ current: section === 'vault' })}
        onClick={() => onClick('vault')}
      >
        {i18n('Vault Settings')}
      </li>
      <li
        className={classnames({ current: section === 'masterpassword' })}
        onClick={() => onClick('masterpassword')}
      >
        {i18n('Master Password')}
      </li>
      <li
        className={classnames({ current: section === 'password' })}
        onClick={() => onClick('password')}
      >
        {i18n('Password Generation')}
      </li>
      <li
        className={classnames({ current: section === 'language' })}
        onClick={() => onClick('language')}
      >
        {i18n('Language')}
      </li>
    </ul>
  )
}

export default Navigation
