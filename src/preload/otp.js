import Speakeasy from 'speakeasy'

window.generateOTP = secret => {
  console.log(secret)
  const code = Speakeasy.totp({
    secret: secret,
    encoding: 'base32'
  })
  const time = 30 - Math.floor((new Date().getTime() / 1000.0) % 30)
  return { code, time }
}

window.verifyOTP = (secret, token) => {
  Speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1
  })
}
