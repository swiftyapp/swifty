const { beforeHelper, afterHelper } = require('./../../helper')

describe('Create credentials entry', function() {
  this.timeout(10000)

  describe('user createst credentials entry', () => {
    before(() => beforeHelper({ storage: 'empty' }))

    after(() => afterHelper())

    it('shows credentials form', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys("\uE007")
          .waitForExist('.body .list .empty')
          .click('.add-button')
          .getText('.aside .actions')
      ).to.eventually.equal('CancelSave')
    })

    it('creates credentials entry', () => {
      return expect(
        app.client
          .setValue('input[name=title]', 'Example')
          .setValue('input[name=website]', 'https://example.com')
          .setValue('input[name=username]', 'myuser')
          .setValue('input[name=password]', 'mypassword')
          .click('.aside .actions .button')
          .getText('.body .list')
      ).to.eventually.equal('Example\nmyuser')
    })

    it('displays show view instead of form', () => {
      return expect(
        app.client
          .waitForExist('.entry-details')
          .getText('.entry-details')
      ).to.eventually.equal(`Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword`)
    })
  })
})
