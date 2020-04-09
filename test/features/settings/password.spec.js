const { beforeHelper, afterHelper } = require('./../../helper')

describe('Password generation settings', function () {
  this.timeout(10000)

  describe('User opens password settings', () => {
    before(() => beforeHelper({ storage: 'empty' }))

    after(() => afterHelper())

    it('shows password settings', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .click('.settings-button')
          .click('.window .navigation li:nth-child(3)')
          .getText('.body h1')
      ).to.eventually.equal('Password Generation')
    })

    it('contains password preview', () => {
      return expect(
        app.client.isExisting('.section:nth-of-type(1) .password-sample')
      ).to.eventually.equal(true)
    })

    it('password preview of default length', () => {
      return expect(
        app.client
          .getText('.section:nth-of-type(1) .password-sample')
          .then(value => value.length)
      ).to.eventually.equal(12)
    })

    it('changes password preview length', () => {
      return expect(
        app.client
          .isExisting('.section:nth-of-type(2) input[type=range]')
          .setValue('.section:nth-of-type(2) input[type=range]', 28)
          .getText('.section:nth-of-type(1) .password-sample')
          .then(value => value.length)
      ).to.eventually.equal(28)
    })

    it('contains numbers checkbox', () => {
      return expect(
        app.client.isExisting('.section:nth-of-type(3) input[name=numbers]')
      ).to.eventually.equal(true)
    })

    it('contains uppercase checkbox', () => {
      return expect(
        app.client.isExisting('.section:nth-of-type(3) input[name=uppercase]')
      ).to.eventually.equal(true)
    })

    it('contains special symbols checkbox', () => {
      return expect(
        app.client.isExisting('.section:nth-of-type(3) input[name=symbols]')
      ).to.eventually.equal(true)
    })
  })
})
