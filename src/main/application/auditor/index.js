import Validator from 'password-validator'
import { DateTime } from 'luxon'
import { decrypt, hash } from '../helpers/encription'

const PASSWORD_LENGTH = 8
const PASSWORD_FRESHNESS = 90

export default class Auditor {
  constructor(data, cryptor) {
    this.data = data
    this.cryptor = cryptor
  }

  getAudit() {
    return new Promise(resolve => {
      let audit = {}
      let hashes = []
      decrypt(this.data, this.cryptor).entries.forEach(item => {
        if (!item.password) return
        this.buildItemAudit(audit, hashes, item)
      })
      this.markRepeating(audit, hashes)
      resolve(audit)
    })
  }

  buildItemAudit(audit, hashes, item) {
    const password = this.cryptor.decrypt(item.password)
    const passHash = hash(password)
    hashes.push(passHash)
    audit[item.id] = {
      hash: passHash,
      isShort: this.isShort(password),
      isWeak: this.isWeak(password),
      isOld: this.isOld(item),
      isRepeating: false
    }
  }

  markRepeating(audit, hashes) {
    Object.values(audit).forEach(item => {
      if (hashes.indexOf(item.hash) !== hashes.lastIndexOf(item.hash))
        item.isRepeating = true
    })
  }

  isShort(password) {
    const schema = new Validator()
    schema.is().min(PASSWORD_LENGTH)
    return !schema.validate(password)
  }

  isWeak(password) {
    const schema = new Validator()
    schema
      .has()
      .uppercase()
      .has()
      .lowercase()
      .has()
      .digits()
      .has()
      .symbols()
    return !schema.validate(password)
  }

  isOld(item) {
    const time = DateTime.fromISO(item.password_updated_at || item.updated_at)
    return Math.abs(time.diffNow('days').days) > PASSWORD_FRESHNESS
  }
}
