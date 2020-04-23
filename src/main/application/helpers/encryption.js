import crypto from 'crypto'

export const hash = value => {
  return crypto.createHash('sha512').update(value).digest('base64')
}
