const fs = require('fs')
const shortid = require('shortid')
const { DateTime } = require('luxon')

const readFile = path => {
  const data = fs.readFileSync(path).toString('utf-8')
  return data
    .split(/\*\*\*.*\*\*\*/)
    .map(datum => {
      if (datum.trim() === '') return null
      return JSON.parse(datum.trim())
    })
    .filter(item => item !== null)
}

const processLogin = item => {
  const fields = item.secureContents.fields
  return {
    id: shortid.generate(),
    type: 'login',
    title: item.title,
    website: item.location,
    username: fields.find(f => f.name === 'username').value,
    password: fields.find(f => f.name === 'password').value,
    email: '',
    note: item.secureContents.notesPlain || '',
    tags: getTags(item),
    otp: '',
    createdAt: getTime(item.createdAt),
    updatedAt: getTime(item.updatedAt)
  }
}

const processNote = item => {
  return {
    id: shortid.generate(),
    type: 'note',
    title: item.title,
    note: item.secureContents.notesPlain,
    tags: getTags(item),
    createdAt: getTime(item.createdAt),
    updatedAt: getTime(item.updatedAt)
  }
}

const processCard = item => {
  const { secureContents } = item
  return {
    id: shortid.generate(),
    type: 'card',
    title: item.title,
    number: secureContents.ccnum || '',
    year: secureContents.expiry_yy || '',
    month: secureContents.expiry_mm || '',
    cvc: secureContents.cvv || '',
    pin: secureContents.pin || '',
    name: secureContents.cardholder || '',
    tags: getTags(item),
    createdAt: getTime(item.createdAt),
    updatedAt: getTime(item.updatedAt)
  }
}

const getTime = stamp => {
  return DateTime.fromSeconds(parseInt(stamp)).toISO()
}

const getTags = item => {
  return (
    (item.openContents &&
      item.openContents.tags &&
      item.openContents.tags.join(' ')) ||
    ''
  )
}

const importData = path => {
  const data = readFile(path)
  const entries = data.map(item => {
    switch (item.typeName) {
      case 'webforms.WebForm':
        return processLogin(item)
      case 'securenotes.SecureNote':
        return processNote(item)
      case 'wallet.financial.CreditCard':
        return processCard(item)
    }
  })
  return entries
}

module.exports = { readFile, importData }
