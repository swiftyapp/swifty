import { login } from 'helpers/login'

describe('Passwords audit', () => {
  beforeAll(async () => await before({ storage: 'collection' }))

  afterAll(async () => await after())

  it('shows vault audit', async () => {
    await login(app)

    const auditButton = await app.client.$('.audit-button')
    await auditButton.click()

    const header = await app.client.$('.aside .audit h3')
    expect(await header.getText()).toBe('Password Audit')

    const weakSection = await app.client.$('.audit-group.level-one .title')
    const weakPasswords = await app.client.$('.audit-group.level-one')
    expect(await weakSection.getText()).toBe('Weak')
    expect(await weakPasswords.getText()).toBe(
      'Weak\nFacebook\nmyuser\nGoogle\nsomeuser\nInstagram\nanotheruser'
    )

    const duplicateSection = await app.client.$(
      '.audit-group.level-three .title'
    )
    const duplicatePasswords = await app.client.$('.audit-group.level-three')
    expect(await duplicateSection.getText()).toBe('Duplicates')
    expect(await duplicatePasswords.getText()).toBe(
      'Duplicates\nFacebook\nmyuser\nGoogle\nsomeuser\nInstagram\nanotheruser'
    )

    const score = await app.client.$('.aside .score')
    expect(await score.getText()).toBe('0\nOveral Score')

    const stats1 = await app.client.$('.aside .stats li:nth-child(1)')
    const stats2 = await app.client.$('.aside .stats li:nth-child(2)')
    const stats3 = await app.client.$('.aside .stats li:nth-child(3)')
    const stats4 = await app.client.$('.aside .stats li:nth-child(4)')

    expect(await stats1.getText()).toBe('Weak\n3')
    expect(await stats2.getText()).toBe('Too Short\n0')
    expect(await stats3.getText()).toBe('Duplicates\n3')
    expect(await stats4.getText()).toBe('More than 6 month old\n3')
  })
})
