import crypto from 'crypto'

const btoa = data => {
  const buffer = Buffer.from(data, 'utf8')
  return buffer.toString('base64')
}

const atob = data => {
  const buffer = Buffer.from(data, 'base64')
  return buffer.toString('utf8')
}

export const hash = value => {
  return crypto
    .createHash('sha512')
    .update(value)
    .digest('base64')
}

export const decrypt = (data, cryptor) => {
  return JSON.parse(cryptor.decrypt(atob(data)))
}

export const encrypt = (data, cryptor) => {
  return btoa(cryptor.encrypt(JSON.stringify(data)))
}
