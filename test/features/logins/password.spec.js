import { login } from 'helpers/login'
import { clickAddButton } from 'helpers/content'
import { setValue } from 'helpers/form'

describe('Password field on entry form', () => {
  beforeAll(async () => await before({ storage: 'empty' }))

  afterAll(async () => await after())

  it('shows credentials form', async () => {
    await login(app)
    await clickAddButton(app)

    await setValue(app, 'password', 'password')
    await app.client.$('.secure-on input[name=password]')

    const viewButton = await app.client.$('.secure-on .view')
    await viewButton.click()

    await app.client.$('.secure-off input[name=password]')

    const input = await app.client.$('input[name=password]')
    expect(await input.getValue()).toBe('password')

    const generateButton = await app.client.$('.secure-off .action')
    await generateButton.click()

    const value = await input.getValue()

    expect(value).not.toBe('password')
    expect(value.length).toBe(12)
  })

  // it('password is hidden by default', async () => {
  //   expect(
  //     await app.client
  //       .setValue('input[name=password]', 'password')
  //       .isExisting('.secure-on input[name=password]')
  //   ).toBe(true)
  // })

  // it('shows password on click reveal', async () => {
  //   expect(
  //     await app.client
  //       .click('.secure-on .view')
  //       .isExisting('.secure-off input[name=password]')
  //   ).toBe(true)
  // })

  // it('shows password on click reveal', async () => {
  //   expect(await app.client.getValue('input[name=password]')).toBe('password')
  // })

  // it('generates password', async () => {
  //   expect(
  //     await app.client
  //       .click('.secure-off .action')
  //       .getValue('input[name=password]')
  //   ).not.toBe('password')
  // })

  // it('replaces current password', async () => {
  //   const value = await app.client.getValue('input[name=password]')
  //   expect(value.length).toBe(12)
  // })
})
