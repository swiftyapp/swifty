const { encrypt, decrypt } = window
const { parse, stringify } = JSON

const SENSITIVE_FIELDS = {
  login: ['password'],
  note: ['note'],
  card: ['pin']
}

export const decryptData = data => {
  return parse(decrypt(atob(data)))
}

export const encryptData = data => {
  return btoa(encrypt(stringify(data)))
}

export const obscure = data => {
  return prepareFields(data, property => encrypt(property))
}

export const expose = data => {
  return prepareFields(data, property => decrypt(property))
}

const prepareFields = (data, callback) => {
  if (!data) return
  const object = Object.assign({}, data)
  SENSITIVE_FIELDS[object.type].forEach(field => {
    object[field] = callback(object[field])
  })
  return object
}
