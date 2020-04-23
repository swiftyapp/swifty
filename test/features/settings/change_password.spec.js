describe('Master password change', () => {
  beforeAll(async () => await before({ storage: 'empty' }))

  afterAll(async () => await after())
  const password = 'password'
  const newpassword = 'newpassword'

  it('shows change password settings', async () => {
    expect(
      await app.client
        .setValue('input[type=password]', password)
        .keys('\uE007')
        .waitForExist('.body .list')
        .click('.settings-button')
        .click('.window .navigation li:nth-child(2)')
        .getText('.body h1')
    ).toBe('Change Master Password')
  })

  it('changes password preview length', async () => {
    expect(
      await app.client
        .isExisting('.section:nth-of-type(2) input[type=range]')
        .setValue('.section:nth-of-type(1) input', password)
        .setValue('.section:nth-of-type(2) input', newpassword)
        .setValue('.section:nth-of-type(3) input', newpassword)
        .click('span.button')
        .getText('.section:nth-of-type(1) input')
        .then(value => value.length)
    ).toBe(0)
  })
})
