let encryption = false

const __setEncryption = value => {
  encryption = value
}

const encrypt = (secret, value) => {
  if (encryption) return `${value}.${secret}`
  return value
}

const decrypt = (secret, value) => {
  if (encryption) return value.split('.')[0]
  return value
}
const constructor = jest.fn(secret => {
  return {
    encrypt: jest.fn(value => {
      return encrypt(secret, value)
    }),
    decrypt: jest.fn(value => {
      return decrypt(secret, value)
    }),
    obscure: jest.fn(data => {
      data.password = encrypt(secret, data.password)
      return data
    }),
    expose: jest.fn(data => {
      data.password = decrypt(secret, data.password)
      return data
    }),
    encryptData: jest.fn(data => {
      if (encryption) {
        return `${JSON.stringify(data)}|${secret}`
      }
      return data
    }),
    decryptData: jest.fn(data => {
      if (encryption) {
        return JSON.parse(data.split('|')[0])
      }
      return data
    }),

    __secret: secret
  }
})
constructor.__setEncryption = __setEncryption

export const Cryptor = constructor
