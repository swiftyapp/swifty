const fs = require('fs')
const shortid = require('shortid')
const { DateTime } = require('luxon')

const PROVIDERS = {
  '1password': require('./1password').transform
}

const readFile = path => {
  return fs.readFileSync(path).toString('utf-8')
}

const getTime = stamp => {
  return DateTime.fromSeconds(parseInt(stamp)).toISO()
}

const importData = (path, provider) => {
  const transform = PROVIDERS[provider]
  const entries = transform(readFile(path))
  entries.forEach(entry => {
    entry.id = shortid.generate()
    entry.createdAt = getTime(entry.createdAt)
    entry.updatedAt = getTime(entry.updatedAt)
  })
  return entries
}

module.exports = { importData }
