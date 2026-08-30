type Arg = string | false | null | undefined | Record<string, boolean | undefined>

// Minimal classnames helper.
export const cx = (...args: Arg[]): string =>
  args
    .flatMap(arg => {
      if (!arg) return []
      if (typeof arg === 'string') return [arg]
      return Object.keys(arg).filter(key => arg[key])
    })
    .join(' ')
