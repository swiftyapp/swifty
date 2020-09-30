import React, { useState, useEffect } from 'react'
import Copy from 'copy.svg'
import { copy } from 'services/copy'

export default ({ name, entry }) => {
  if (!entry.otp || entry.otp == '') return null

  const [time, setTime] = useState(0)
  const [code, setCode] = useState('')

  useEffect(() => {
    setOTPData()
    const interval = setInterval(() => {
      if (time > 0) {
        setTime(time - 1)
      } else {
        setOTPData()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const setOTPData = () => {
    const otp = window.GeneratorAPI.generateOTP(
      window.CryptorAPI.decrypt(entry.otp)
    )
    setTime(otp.time)
    setCode(otp.code)
  }

  const formattedValue = () => `${code.substr(0, 3)} ${code.substr(3)}`

  return (
    <div className="item">
      <div className="label">{name}</div>
      <div className="value">
        <strong className="muted">{formattedValue()}</strong>
      </div>
      <div className="secondary">{time}</div>
      <Copy width="16" height="16" onClick={() => copy(code)} />
    </div>
  )
}
