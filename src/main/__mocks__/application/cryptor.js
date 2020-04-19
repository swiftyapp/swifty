let encryption = false

const __setEncryption = value => {
  encryption = value
}

const constructor = jest.fn(secret => {
  return {
    encrypt: jest.fn(value => {
      if (encryption) return `${value}.${secret}`
      return value
    }),
    decrypt: jest.fn(value => {
      if (encryption) return value.split('.')[0]
      return value
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
