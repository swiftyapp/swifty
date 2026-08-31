import type { GeneratorOptions } from '@/lib/commands'

const defaults: GeneratorOptions = {
  length: 20,
  numbers: true,
  symbols: true,
  uppercase: true,
  exclude: ''
}

const KEY = 'swifty:generatorDefaults'

export const getProps = (): GeneratorOptions => {
  const stored = localStorage.getItem(KEY)
  if (!stored) {
    setProps(defaults)
    return defaults
  }
  return JSON.parse(stored)
}

export const setProps = (props: GeneratorOptions) =>
  localStorage.setItem(KEY, JSON.stringify(props))
