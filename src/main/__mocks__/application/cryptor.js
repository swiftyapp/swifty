const encrypt = jest.fn(data => data)
const decrypt = jest.fn(data => data)
const encryptData = jest.fn(data => data)
const decryptData = jest.fn(data => {
  return data
})

const constructor = jest.fn(secret => {
  return {
    encrypt,
    decrypt,
    encryptData,
    decryptData,
    __secret: secret
  }
})

constructor.encrypt = encrypt
constructor.decrypt = decrypt
constructor.encryptData = encryptData
constructor.decryptData = decryptData

export const Cryptor = constructor
