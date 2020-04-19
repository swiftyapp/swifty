import { Cryptor as BaseCryptor } from '@swiftyapp/cryptor'

const btoa = data => {
  const buffer = Buffer.from(data, 'utf8')
  return buffer.toString('base64')
}

const atob = data => {
  const buffer = Buffer.from(data, 'base64')
  return buffer.toString('utf8')
}

export class Cryptor {
  constructor(secret) {
    this.cryptor = new BaseCryptor(secret)
  }

  encrypt(data) {
    return btoa(this.cryptor.encrypt(JSON.stringify(data)))
  }

  decrypt(encypted) {
    return JSON.parse(this.cryptor.decrypt(atob(encypted)))
  }
}
