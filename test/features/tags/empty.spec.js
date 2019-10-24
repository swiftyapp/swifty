const { beforeHelper, afterHelper } = require('./../../helper')

describe('Empty tag filter', function() {
  this.timeout(10000)

  describe('user sees empty state for tags', () => {
    before(() => beforeHelper({ storage: 'collection' }))

    after(() => afterHelper())

    it('shows tag filter toggle', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .entry')
          .isExisting('.tag-icon')
      ).to.eventually.equal(true)
    })

    it('displays empty state for tags', () => {
      return expect(
        app.client.click('.tag-icon').getText('.tag-filter .dropdown')
      ).to.eventually.equal(
        'Start tagging your entries\nto filter them by tags.'
      )
    })
  })
})
