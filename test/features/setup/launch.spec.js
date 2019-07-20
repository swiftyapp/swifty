const { beforeHelper, afterHelper } = require('./../../helper')

describe('Application first launch', function() {
  this.timeout(10000)

  before(() => beforeHelper({ storage: 'pristine' }))

  after(() => afterHelper())

  it('shows new user section', () => {
    return expect(
      app.client.getText('.top-lock h2')
    ).to.eventually.equal('I am a new User')
  })

  it('shows new user button', () => {
    return expect(
      app.client.getText('.top-lock .button')
    ).to.eventually.equal('Setup Master Password')
  })

  it('shows restore backup section', () => {
    return expect(
      app.client.getText('.bottom-lock h2')
    ).to.eventually.equal('I am existing User')
  })

  it('shows restore button', () => {
    return expect(
      app.client.getText('.bottom-lock .button')
    ).to.eventually.equal('Restore from Backup')
  })
})
