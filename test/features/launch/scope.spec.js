const { beforeHelper, afterHelper } = require('./../../helper')

describe('Scope switching', function() {
  this.timeout(10000)

  describe('user launches application', () => {
    before(() => beforeHelper({ storage: 'example' }))

    after(() => afterHelper())

    it('shows 3 scopes', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.sidebar')
          .isExisting('.switcher .tooltip-context:nth-child(3)')
      ).to.eventually.equal(true)
    })

    it('highlights logins scope as current', () => {
      return expect(
        app.client.isExisting(
          '.switcher .tooltip-context:nth-child(1) .item.current'
        )
      ).to.eventually.equal(true)
    })

    it('displays entries for given scope', () => {
      return expect(
        app.client.getText('.body .list .entry')
      ).to.eventually.equal('Example\nmyuser')
    })

    it('switches scope to notes', () => {
      return expect(
        app.client
          .click('.switcher .tooltip-context:nth-child(2)')
          .isExisting('.switcher .tooltip-context:nth-child(2) .item.current')
      ).to.eventually.equal(true)
    })

    it('displays entries for given scope', () => {
      return expect(app.client.getText('.body .list')).to.eventually.equal(
        'No Items'
      )
    })

    it('switches scope to cards', () => {
      return expect(
        app.client
          .click('.switcher .tooltip-context:nth-child(3)')
          .isExisting('.switcher .tooltip-context:nth-child(3) .item.current')
      ).to.eventually.equal(true)
    })

    it('displays entries for given scope', () => {
      return expect(app.client.getText('.body .list')).to.eventually.equal(
        'No Items'
      )
    })

    it('switches scope back to logins', () => {
      return expect(
        app.client
          .click('.switcher .tooltip-context:nth-child(1)')
          .isExisting('.switcher .tooltip-context:nth-child(1) .item.current')
      ).to.eventually.equal(true)
    })

    it('displays entries for given scope', () => {
      return expect(app.client.getText('.body .list')).to.eventually.equal(
        'Example\nmyuser'
      )
    })
  })
})
