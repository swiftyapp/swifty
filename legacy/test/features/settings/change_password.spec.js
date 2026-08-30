import { login } from 'helpers/login'
import { openSettingsSection } from 'helpers/settings'
import { setValue } from 'helpers/form'

describe('Master password change', () => {
  beforeAll(async () => await before({ storage: 'empty' }))

  afterAll(async () => await after())
  const password = 'password'
  const newpassword = 'newpassword'

  it('shows change password settings', async () => {
    await login(app)
    await openSettingsSection(app, 'password')

    const header = await app.client.$('.body h1')
    expect(await header.getText()).toBe('Change Master Password')

    await setValue(app, 'current_password', password)
    await setValue(app, 'new_password', newpassword)
    await setValue(app, 'new_password_repeat', newpassword)

    const button = await app.client.$('span.button')
    await button.click()

    const input = await app.client.$('.section:nth-of-type(1) input')
    expect(await input.getText()).toBe('')
  })
})
