const { beforeHelper, afterHelper } = require('./../../helper')

describe('Setting up master password', function() {
  this.timeout(10000)

  describe('user password setup', () => {
    beforeEach(() => beforeHelper({ storage: 'pristine' }))

    afterEach(() => afterHelper())

    it('shows non-matching password error', () => {
      return expect(
        app.client
          .click('.top-lock .button')
          .setValue('input[type=password]', 'password')
          .click('.button')
          .setValue('input[type=password]', 'pass')
          .click('.button')
          .getText('.error-message')
      ).to.eventually.equal('Passwords do not match')
    })

    it('shows app main window on password match', () => {
      return expect(
        app.client
          .click('.top-lock .button')
          .setValue('input[type=password]', 'password')
          .click('.button')
          .setValue('input[type=password]', 'password')
          .click('.button')
          .isExisting('.sync-indicator')
      ).to.eventually.equal(true)
    })
  })
})
