const encrypt = jest.fn(data => data)
const decrypt = jest.fn(data => data)

const constructor = jest.fn(secret => {
  return {
    encrypt,
    decrypt,
    __secret: secret
  }
})
constructor.encrypt = encrypt
constructor.decrypt = decrypt

export const Cryptor = constructor
