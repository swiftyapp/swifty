export const isWindows = () => {
  return /^win/i.test(process.platform)
}

export const isMacOS = () => {
  return /darwin/i.test(process.platform)
}

export const isLinux = () => {
  return /linux/i.test(process.platform)
}

export const platform = () => {
  if (isWindows()) return 'windows'
  if (isMacOS()) return 'macos'
  if (isLinux()) return 'linux'
  return null
}
