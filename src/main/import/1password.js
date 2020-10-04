const processLogin = item => {
  const fields = item.secureContents.fields
  return {
    type: 'login',
    title: item.title,
    website: item.location,
    username: fields.find(f => f.name === 'username').value,
    password: fields.find(f => f.name === 'password').value,
    email: '',
    note: item.secureContents.notesPlain || '',
    tags: getTags(item),
    otp: '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

const processNote = item => {
  return {
    type: 'note',
    title: item.title,
    note: item.secureContents.notesPlain,
    tags: getTags(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

const processCard = item => {
  const { secureContents } = item
  return {
    type: 'card',
    title: item.title,
    number: secureContents.ccnum || '',
    year: secureContents.expiry_yy || '',
    month: secureContents.expiry_mm || '',
    cvc: secureContents.cvv || '',
    pin: secureContents.pin || '',
    name: secureContents.cardholder || '',
    tags: getTags(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

const getTags = item => {
  return (
    (item.openContents &&
      item.openContents.tags &&
      item.openContents.tags.join(' ')) ||
    ''
  )
}

const parse = data => {
  return data
    .split(/\*\*\*.*\*\*\*/)
    .map(datum => {
      if (datum.trim() === '') return null
      return JSON.parse(datum.trim())
    })
    .filter(item => item !== null)
}

const transform = data => {
  const entries = parse(data).map(item => {
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

module.exports = { transform }
