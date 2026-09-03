import type { GeneratorOptions } from '@/lib/commands'

const defaults: GeneratorOptions = {
  length: 20,
  numbers: true,
  symbols: true,
  uppercase: true,
  exclude: ''
}

const KEY = 'swifty:generatorDefaults'

// Stored JSON is user-writable and predates every knob added since it was
// written, so it is merged over the defaults instead of trusted as a whole
// shape — a corrupt or partial blob degrades to the defaults rather than
// handing `undefined` to the generator.
export const getProps = (): GeneratorOptions => {
  try {
    const stored = localStorage.getItem(KEY)
    if (!stored) return defaults
    const props = { ...defaults, ...(JSON.parse(stored) as Partial<GeneratorOptions>) }
    return Number.isFinite(props.length) ? props : { ...props, length: defaults.length }
  } catch {
    return defaults
  }
}

export const setProps = (props: GeneratorOptions) =>
  localStorage.setItem(KEY, JSON.stringify(props))
