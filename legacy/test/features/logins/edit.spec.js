import { login } from 'helpers/login'
import { setValue } from '../../helpers/form'

describe('Edit credential entry', () => {
  beforeAll(async () => await before({ storage: 'example' }))

  afterAll(async () => await after())

  it('shows credentials view', async () => {
    await login(app)

    const entry = await app.client.$('.list .entry')
    await entry.click()

    const details = await app.client.$('.entry-details')
    expect(await details.getText()).toBe(
      `Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword`
    )

    const editIcon = await app.client.$('.entry-title .action:nth-of-type(1)')
    await editIcon.click()

    const actions = await app.client.$('.aside .actions')
    expect(await actions.getText()).toBe('CancelSave')

    await setValue(app, 'title', 'Example Updated')

    const cancelButton = await app.client.$('.actions .cancel')
    await cancelButton.click()

    const list = await app.client.$('.body .list')
    expect(await list.getText()).toBe('Example\nmyuser')

    const viewTitle = await app.client.$('.entry-title h1')
    expect(await viewTitle.getText()).toBe('Example')

    await editIcon.click()

    const titleInput = await app.client.$('input[name=title]')
    expect(await titleInput.getValue()).toBe('Example')

    await setValue(app, 'title', 'Example Updated')

    const saveButton = await app.client.$('.actions .button')
    await saveButton.click()

    expect(await list.getText()).toBe('Example Updated\nmyuser')

    expect(await viewTitle.getText()).toBe('Example Updated')
  })
})
