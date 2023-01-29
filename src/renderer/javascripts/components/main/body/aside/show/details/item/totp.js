import React, { useState, useEffect, useCallback } from 'react'
import Copy from 'copy.svg'
import { copy } from 'services/copy'

export default ({ name, entry }) => {
  const { i18n } = window
  if (!entry.otp || entry.otp == '') return null

  const [time, setTime] = useState(0)
  const [code, setCode] = useState('')

  useEffect(() => {
    setOTPData(entry.otp)
    const interval = setTimeout(() => {
      if (time > 0) {
        setTime(time - 1)
      } else {
        setOTPData(entry.otp)
      }
    }, 1000)
    return () => clearTimeout(interval)
  }, [entry.otp, setOTPData, time])

  const setOTPData = useCallback(code => {
    const otp = window.GeneratorAPI.generateOTP(window.CryptorAPI.decrypt(code))
    setTime(otp.time)
    setCode(otp.code)
  }, [])

  const formattedValue = () => `${code.substr(0, 3)} ${code.substr(3)}`

  return (
    <div className="item">
      <div className="label">{i18n(name)}</div>
      <div className="value">
        <strong className="muted">{formattedValue()}</strong>
      </div>
      <div className="secondary">{time}</div>
      <Copy width="16" height="16" onClick={() => copy(code)} />
    </div>
  )
}
