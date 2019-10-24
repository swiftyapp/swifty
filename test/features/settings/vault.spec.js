const { beforeHelper, afterHelper } = require('./../../helper')

describe('Vault settings', function() {
  this.timeout(10000)

  describe('User opens vault settings', () => {
    before(() => beforeHelper({ storage: 'empty' }))

    after(() => afterHelper())

    it('shows vault settings', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .click('.settings-button')
          .getText('.body h1')
      ).to.eventually.equal('Vault Settings')
    })

    it('contains connect to google drive button', () => {
      return expect(
        app.client.getText('.section:nth-of-type(1) .button')
      ).to.eventually.equal('Connect your Google Drive')
    })

    it('contains save vault file button', () => {
      return expect(
        app.client.getText('.section:nth-of-type(2) .button')
      ).to.eventually.equal('Save Vault File')
    })
  })
})
