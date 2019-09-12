const { beforeHelper, afterHelper } = require('./../../helper')

describe('Empty entries list', function() {
  this.timeout(10000)

  describe('user loads main application window', () => {
    before(() => beforeHelper({ storage: 'empty' }))

    after(() => afterHelper())

    it('shows empty entries list', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .getText('.body .list')
      ).to.eventually.equal('No Items')
    })

    it('shows empty state for item form', () => {
      return expect(app.client.getText('.aside .empty')).to.eventually.equal(
        'Swifty\nKeep your passwords safe and organized\nCreate First Entry\nor\nImport from Gdrive'
      )
    })
  })
})
