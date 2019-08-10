const { beforeHelper, afterHelper } = require('./../../helper')

describe('Authentication with master password', function() {
  this.timeout(10000)

  describe('user enters password', () => {
    beforeEach(() => beforeHelper({ storage: 'empty' }))

    afterEach(() => afterHelper())

    it('shows invalid password error', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'word')
          .keys('\uE007')
          .getText('.error-message')
      ).to.eventually.equal('Incorrect Master Password')
    })

    it('logs user in on correct password', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .isExisting('.sync-indicator')
      ).to.eventually.equal(true)
    })
  })
})
