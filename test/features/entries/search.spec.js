const { beforeHelper, afterHelper } = require('./../../helper')

describe('Search credential entries', function() {
  this.timeout(10000)

  describe('user deletes credentials entry', () => {
    before(() => beforeHelper({ storage: 'collection' }))

    after(() => afterHelper())

    it('shows credentials', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys("\uE007")
          .waitForExist('.body .list .entry')
          .isExisting('.list .entry:nth-child(3)')
      ).to.eventually.equal(true)
    })
    
    it('filters entries', () => {
      return expect(
        app.client
          .setValue('.search input', 'in')
          .isExisting('.list .entry:nth-child(2)')
      ).to.eventually.equal(false)
    })
    
    it('shows only matching entries', () => {
      return expect(
        app.client
          .setValue('.search input', 'in')
          .getText('.list .entry:nth-child(1)')
      ).to.eventually.equal('Instagram\nanotheruser')
    })
    
    it('adds entries back on clear filter', () => {
      return expect(
        app.client
          .keys("\uE003")
          .keys("\uE003")
          .isExisting('.list .entry:nth-child(3)')
      ).to.eventually.equal(true)
    })
  })
})
