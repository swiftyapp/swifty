export const login = async (app, value = 'password') => {
  const input = await app.client.$('input[type=password]')
  await input.setValue(value)
  await input.keys('\uE007')
}
