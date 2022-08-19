import crypto from 'crypto'
import { Cryptor as BaseCryptor } from '@swiftyapp/cryptor'

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

export const hashSecret = value => {
  return crypto.createHash('sha512').update(value).digest('base64')
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
    this.cryptor = new BaseCryptor(secret)
  }

  encryptData(data) {
    return btoa(this.encrypt(JSON.stringify(data)))
  }

  decryptData(encrypted) {
    return JSON.parse(this.decrypt(atob(encrypted)))
  }

  encrypt(data) {
    return this.cryptor.encrypt(data)
  }

  decrypt(data) {
    return this.cryptor.decrypt(data)
  }

  obscure(data) {
    return prepareFields(data, property => this.encrypt(property))
  }

  expose(data) {
    return prepareFields(data, property => this.decrypt(property))
  }
}
