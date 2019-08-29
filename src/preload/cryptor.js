import crypto from 'crypto'

window.hashSecret = value => {
  return crypto
    .createHash('sha512')
    .update(value)
    .digest('base64')
}
