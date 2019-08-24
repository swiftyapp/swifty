import generator from 'generate-password'

window.generatePassword = options => {
  return generator.generate(options)
}
