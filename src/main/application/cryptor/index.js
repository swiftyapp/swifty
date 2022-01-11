import { encrypt, decrypt } from '@swiftyapp/aes-256-gcm'

const SENSITIVE_FIELDS = {
  login: ['password', 'otp'],
  note: ['note'],
  card: ['pin']
}

const btoa = data => {
  const buffer = Buffer.from(data, 'utf8')
  return buffer.toString('base64')
}

const atob = data => {
  const buffer = Buffer.from(data, 'base64')
  return buffer.toString('utf8')
}

const prepareFields = (data, callback) => {
  if (!data) return
  const object = Object.assign({}, data)
  SENSITIVE_FIELDS[object.type].forEach(field => {
    if (!object[field] || object[field] === '') {
      object[field] = ''
    } else {
      object[field] = callback(object[field])
    }
  })
  return object
}

export class Cryptor {
  constructor(secret) {
    this.secret = secret
  }

  encryptData(data) {
    return btoa(this.encrypt(JSON.stringify(data)))
  }

  decryptData(encrypted) {
    return JSON.parse(this.decrypt(atob(encrypted)))
  }

  encrypt(data) {
    return encrypt(data, this.secret)
  }

  decrypt(data) {
    return decrypt(data, this.secret)
  }

  obscure(data) {
    return prepareFields(data, property => encrypt(property, this.secret))
  }

  expose(data) {
    return prepareFields(data, property => decrypt(property, this.secret))
  }
}
