import { DateTime as Datetime } from 'luxon'

const now = Datetime.local()

export const DateTime = {
  local: () => {
    return {
      toISO: jest.fn().mockReturnValue(now.toISO()),
      __minus: (value, units) => {
        return now.minus(value, units)
      }
    }
  },
  fromISO: jest.fn(string => {
    return Datetime.fromISO(string)
  })
}
