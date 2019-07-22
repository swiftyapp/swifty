const { beforeHelper, afterHelper, prepareSotrage } = require('./../../helper')

describe('Edit credential entry', function() {
  this.timeout(10000)

  describe('user edits credentials entry', () => {
    before(() => beforeHelper({ storage: 'example' }))

    after(() => afterHelper())

    it('shows credentials view', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys("\uE007")
          .waitForExist('.body .list .entry')
          .click('.list .entry')
          .getText('.entry-details')
      ).to.eventually.equal(`Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword`)
    })

    it('shows edit form', () => {
      return expect(
        app.client
          .click('.entry-title .action:nth-of-type(1)')
          .getText('.aside .actions')
      ).to.eventually.equal('CancelSave')
    })

    it('updates credential entry', () => {
      return expect(
        app.client
          .setValue('input[name=title]', 'Example Updated')
          .click('.actions .button')
          .getText('.list .entry')
      ).to.eventually.equal('Example Updated\nmyuser')
    })

    it('displays show view in a sidebar', () => {
      return expect(
        app.client
          .getText('.entry-title h1')
      ).to.eventually.equal('Example Updated')
    })
  })
})
