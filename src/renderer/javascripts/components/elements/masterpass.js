import React from 'react'
import classnames from 'classnames'
import Error from './error'
import Touchid from 'touchid.svg'

export default ({
  error,
  touchID,
  placeholder,
  onEnter,
  onChange,
  onTouchID
}) => {
  const cssClasses = () => {
    return classnames('masterpass-input', { error: error })
  }

  const placeholderText = () => {
    return placeholder || 'Master Password'
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter' && event.currentTarget.value !== '') {
      if (onEnter) onEnter(event.currentTarget.value)
    }
  }

  return (
    <div className={cssClasses()}>
      <Error error={error} />
      <input
        type="password"
        maxLength="24"
        placeholder={placeholderText()}
        onChange={onChange}
        onKeyDown={handleKeyDown}
      />
      {touchID && (
        <Touchid
          width="32"
          height="32"
          className="touchid"
          onClick={onTouchID}
        />
      )}
    </div>
  )
}
