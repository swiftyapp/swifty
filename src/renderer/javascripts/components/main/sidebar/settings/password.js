import React from 'react'

const Password = ({ section }) => {
  if (section !== 'password') return null
  return (
    <>
      <h1>Password Generation</h1>
      <div className="section">
        <strong>Length</strong>
        <div>Define length of a password</div>
        <input type="text" />
      </div>
      <div className="section">
        <strong>Symbols</strong>
        <div>
          <label htmlFor="">
            <input type="checkbox" />
            Numbers
          </label>
        </div>
        <div>
          <label htmlFor="">
            <input type="checkbox" />
            Symbols
          </label>
        </div>
        <div>
          <label htmlFor="">
            <input type="checkbox" />
            Uppercase
          </label>
        </div>
      </div>
      <div className="section">
        <strong>Exclude</strong>
        <div>Specify characters to be excluded from password</div>
        <input type="text" />
      </div>
    </>
  )
}

export default Password
