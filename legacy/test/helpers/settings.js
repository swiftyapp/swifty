export const openSettings = async app => {
  const settingsButton = await app.client.$('.settings-button')
  await settingsButton.click()
}

export const openSettingsSection = async (app, section) => {
  const SECTIONS = ['vault', 'password', 'generator']

  await openSettings(app)
  const index = SECTIONS.indexOf(section) + 1
  const navigatioItem = await app.client.$(
    `.window .navigation li:nth-child(${index})`
  )
  await navigatioItem.click()
}
