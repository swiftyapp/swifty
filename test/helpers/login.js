export const login = async app => {
  const input = await app.client.$('input[type=password]')
  await input.setValue('password')
  await input.keys('\uE007')
}
