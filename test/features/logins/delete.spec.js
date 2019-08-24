const { beforeHelper, afterHelper } = require('./../../helper')

describe('Delete credentials entry', function() {
  this.timeout(10000)

  describe('user deletes credentials entry', () => {
    before(() => beforeHelper({ storage: 'example' }))

    after(() => afterHelper())

    it('shows credentials view', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .entry')
          .click('.list .entry')
          .getText('.entry-details')
      ).to.eventually.equal(
        `Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword`
      )
    })

    it('deletes credentials entry', () => {
      return expect(
        app.client
          .click('.entry-title .action:nth-of-type(2)')
          .getText('.body .list')
      ).to.eventually.equal('No Items')
    })
  })
})
