import { contextBridge } from 'electron'
import Speakeasy from 'speakeasy'

import generator from 'generate-password'

contextBridge.exposeInMainWorld('GeneratorAPI', {
  generatePassword: options => {
    return generator.generate(options)
  },
  generateOTP: secret => {
    const code = Speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    })
    const time = 30 - Math.floor((new Date().getTime() / 1000.0) % 30)
    return { code, time }
  },
  verifyOTP: (secret, token) => {
    Speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1
    })
  }
})
