import { login } from 'helpers/login'
import { clickAddButton } from 'helpers/content'
import { setValue } from '../../helpers/form'

describe('Create credentials entry', () => {
  beforeAll(async () => await before({ storage: 'empty' }))

  afterAll(async () => await after())

  it('shows credentials form', async () => {
    await login(app)
    await clickAddButton(app)

    const list = await app.client.$('.body .list')

    const actions = await app.client.$('.aside .actions')
    expect(await actions.getText()).toBe('CancelSave')

    const saveButton = await app.client.$('.aside .actions .button')
    await saveButton.click()

    await app.client.$('.field.error:nth-of-type(3)')

    await setValue(app, 'title', 'Example')

    const cancelButton = await app.client.$('.aside .actions .cancel')
    await cancelButton.click()

    expect(await list.getText()).toBe('No Items')

    const aside = await app.client.$('.aside')

    expect(await aside.getText()).toBe(
      'Swifty\nKeep your passwords safe and organized\nCreate First Entry\nor\nImport from Gdrive'
    )
    await clickAddButton(app)

    const titleInput = await app.client.$('input[name=title]')

    expect(await titleInput.getValue()).toBe('')

    await setValue(app, 'title', 'Example')
    await setValue(app, 'website', 'https://example.com')
    await setValue(app, 'username', 'myuser')
    await setValue(app, 'password', 'mypassword')

    await saveButton.click()

    expect(await list.getText()).toBe('Example\nmyuser')

    const details = await app.client.$('.entry-details')
    expect(await details.getText()).toBe(
      'Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword'
    )
  })
})
