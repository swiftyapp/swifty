const { beforeHelper, afterHelper } = require('./../../helper')

describe('Password field on entry form', function() {
  this.timeout(10000)

  describe('show/hide password', () => {
    before(() => beforeHelper({ storage: 'empty' }))

    after(() => afterHelper())

    it('shows credentials form', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys("\uE007")
          .click('.add-button')
          .isExisting('input[name=password]')
      ).to.eventually.equal(true)
    })

    it('password is hidden by defaul', () => {
      return expect(
        app.client
          .setValue('input[name=password]', 'password')
          .isExisting('.secure-on input[name=password]')
      ).to.eventually.equal(true)
    })
    
    it('shows password on click reveal', () => {
      return expect(
        app.client
          .click('.secure-on .view')
          .isExisting('.secure-off input[name=password]')
      ).to.eventually.equal(true)
    })
    
    it('shows password on click reveal', () => {
      return expect(
        app.client.getValue('input[name=password]')
      ).to.eventually.equal('password')
    })
    
    it('generates password', () => {
      return expect(
        app.client
          .click('.secure-off .action')
          .getValue('input[name=password]')
      ).to.not.eventually.equal('password')
    })
    
    it('replaces current password', () => {
      return app.client.getValue('input[name=password]').then(value => {
        expect(value.length).to.equal(12)
      })
    })
  })
})
