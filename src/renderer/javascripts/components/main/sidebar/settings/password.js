import React, { useState } from 'react'
import { getProps, setProps } from 'defaults/generator'

const Password = ({ section }) => {
  const { i18n } = window
  const [options, setOptions] = useState(getProps())
  const [example, setExample] = useState(
    window.GeneratorAPI.generatePassword(getProps())
  )

  const onChange = event => {
    const option = {}
    option[event.target.name] = event.target.checked
    updateOption(option)
  }

  const onValueChange = event => {
    const option = {}
    option[event.target.name] = event.target.value
    updateOption(option)
  }

  const updateOption = option => {
    const upadtedOptions = { ...options, ...option }
    setExample(window.GeneratorAPI.generatePassword(upadtedOptions))
    setProps(upadtedOptions)
    setOptions(upadtedOptions)
  }

  if (section !== 'password') return null
  return (
    <>
      <h1>{i18n('Password Settings')}</h1>
      <div className="section">
        <strong>{i18n('Example')}</strong>
        <div className="password-sample">{example}</div>
      </div>
      <div className="section">
        <strong>{i18n('Length')}</strong>
        <div>
          <input
            type="range"
            name="length"
            min="6"
            max="50"
            className="slider"
            value={options.length}
            onChange={onValueChange}
          />
          <div className="pass-count">{options.length}</div>
        </div>
      </div>
      <div className="section">
        <strong>{i18n('Symbols')}</strong>
        <div>
          <label>
            <input
              type="checkbox"
              name="numbers"
              checked={options.numbers}
              value={options.numbers}
              onChange={onChange}
            />
            {i18n('Numbers')}
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="uppercase"
              checked={options.uppercase}
              value={options.uppercase}
              onChange={onChange}
            />
            {i18n('Uppercase')}
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="symbols"
              checked={options.symbols}
              value={options.symbols}
              onChange={onChange}
            />
            {i18n('Special characters')}
          </label>
        </div>
      </div>
    </>
  )
}

export default Password
