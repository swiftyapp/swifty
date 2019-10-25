import { filterEntries } from 'renderer/javascripts/services/entries'

let entries = [
  {
    title: 'Google',
    type: 'password',
    password: 'password',
    tags: ['personal']
  },
  {
    title: 'Airbnb',
    type: 'password',
    password: 'password'
  },
  {
    title: 'Facebook',
    type: 'password',
    password: 'password',
    tags: ['personal']
  }
]

let options = {
  scope: 'password',
  query: '',
  tags: []
}

describe('#filterEntries', () => {
  describe('sorting entires', () => {
    test('returns passwords ordered by title', () => {
      expect(filterEntries(entries, options)).toEqual([
        {
          title: 'Airbnb',
          type: 'password',
          password: 'password'
        },
        {
          title: 'Facebook',
          type: 'password',
          password: 'password',
          tags: ['personal']
        },
        {
          title: 'Google',
          type: 'password',
          password: 'password',
          tags: ['personal']
        }
      ])
    })
  })

  describe('filter entries by scope', () => {
    let scopedEntries = []

    beforeEach(() => {
      scopedEntries = entries.concat([
        {
          title: 'Payoneer',
          type: 'card',
          number: '4242424242424242'
        }
      ])
    })

    describe('password scope', () => {
      test('returns only passwords', () => {
        expect(filterEntries(scopedEntries, options)).toEqual([
          {
            title: 'Airbnb',
            type: 'password',
            password: 'password'
          },
          {
            title: 'Facebook',
            type: 'password',
            password: 'password',
            tags: ['personal']
          },
          {
            title: 'Google',
            type: 'password',
            password: 'password',
            tags: ['personal']
          }
        ])
      })
    })

    describe('card scope', () => {
      beforeEach(() => {
        options = { scope: 'card', query: '', tags: [] }
      })

      test('returns only cards', () => {
        expect(filterEntries(scopedEntries, options)).toEqual([
          {
            number: '4242424242424242',
            title: 'Payoneer',
            type: 'card'
          }
        ])
      })
    })
  })

  describe('filter entires by query', () => {
    beforeEach(() => {
      options = { scope: 'password', query: 'fa', tags: [] }
    })
    test('returns only matching entries', () => {
      expect(filterEntries(entries, options)).toEqual([
        {
          title: 'Facebook',
          type: 'password',
          password: 'password',
          tags: ['personal']
        }
      ])
    })
  })

  describe('filter entries by tags', () => {
    beforeEach(() => {
      options = { scope: 'password', query: '', tags: ['personal'] }
    })

    test('returns only passwords', () => {
      expect(filterEntries(entries, options)).toEqual([
        {
          title: 'Facebook',
          type: 'password',
          password: 'password',
          tags: ['personal']
        },
        {
          title: 'Google',
          type: 'password',
          password: 'password',
          tags: ['personal']
        }
      ])
    })
  })
})
