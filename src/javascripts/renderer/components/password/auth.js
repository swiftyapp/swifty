import { ipcRenderer } from 'electron'
import classnames from 'classnames'
import React from 'react'
import { connect } from 'react-redux'

const Auth = ({ auth, clearError }) => {
  const handleKeyDown = event => {
    if (event.key === 'Enter') {
      ipcRenderer.send('auth:done', event.currentTarget.value)
    }
  }

  const handleChange = event => {
    if (event.currentTarget.value === '') clearError()
  }

  const errorMessage = () => {
    if (!auth.failure) return null
    return <div>Incorrect Master Password</div>
  }

  const cssClasses = () => {
    return classnames('masterpass-input', { error: auth.failure })
  }

  return (
    <div className="lock-screen">
      <div className="top-lock">
        <img src="images/lock_icon.png" alt="" width="100" />
      </div>
      <div className="bottom-lock">
        <div className={cssClasses()}>
          <input
            type="password"
            placeholder="Master Password"
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <div className="error-message">{errorMessage()}</div>
        </div>
      </div>
    </div>
  )
}

const mapStateToProps = state => {
  return {
    auth: state.auth
  }
}
const mapDispatchToProps = dispatch => {
  return {
    clearError: () => {
      dispatch({type: 'AUTH_CLEAR'})
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Auth)
