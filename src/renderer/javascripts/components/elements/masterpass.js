import React from 'react'
import classnames from 'classnames'
import Error from './error'

export default ({ placeholder, error, onEnter, onChange }) => {

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
        placeholder={placeholderText()}
        onChange={onChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
