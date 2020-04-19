import { DateTime } from 'luxon'

import { mergeData } from 'main/application/sync/base/merge'
import { Cryptor } from 'main/application/cryptor'

const currentTime = DateTime.local()
const secondsAgo = currentTime.__minus(5, 'seconds')
const fourMinutesAgo = currentTime.__minus(4, 'minutes')
const fiveMinutesAgo = currentTime.__minus(5, 'minutes')

describe('#mergeData', () => {
  const cryptor = new Cryptor()
  let local, remote

  describe('remote data is empty', () => {
    beforeEach(() => {
      local = {
        entries: [
          {
            id: 'poHuE',
            title: 'Instagram',
            password: 'password',
            updatedAt: fourMinutesAgo
          }
        ],
        updatedAt: secondsAgo.toISO()
      }
      remote = null
    })

    test('returns local data with updated at timestamp', async () => {
      expect(mergeData(local, remote, cryptor)).toStrictEqual({
        entries: [
          {
            id: 'poHuE',
            title: 'Instagram',
            password: 'password',
            updatedAt: fourMinutesAgo
          }
        ],
        updatedAt: currentTime.toISO()
      })
    })
  })

  describe('unique entries', () => {
    beforeEach(() => {
      local = {
        entries: [
          {
            id: 'poHuE',
            title: 'Instagram',
            password: 'password',
            updatedAt: fiveMinutesAgo.toISO()
          }
        ],
        updatedAt: secondsAgo.toISO()
      }
      remote = {
        entries: [
          {
            id: 'SSsLF',
            title: 'Facebook',
            password: 'qwerty',
            updatedAt: fourMinutesAgo.toISO()
          }
        ],
        updatedAt: currentTime.toISO()
      }
    })

    test('returns merged data with updated at timestamp', async () => {
      expect(mergeData(local, remote, cryptor)).toStrictEqual({
        entries: [
          {
            id: 'SSsLF',
            title: 'Facebook',
            password: 'qwerty',
            updatedAt: fourMinutesAgo.toISO()
          }
        ],
        updatedAt: currentTime.toISO()
      })
    })
  })

  describe('repeating entries', () => {
    beforeEach(() => {
      local = {
        entries: [
          {
            id: 'IohvN',
            title: 'Instagram',
            password: 'password',
            updatedAt: fourMinutesAgo.toISO()
          },
          {
            id: 'SSsLF',
            title: 'Facebook',
            password: 'localpassword',
            updatedAt: fiveMinutesAgo.toISO()
          }
        ]
      }
      remote = {
        entries: [
          {
            id: 'SSsLF',
            title: 'Facebook',
            password: 'remotepassword',
            updatedAt: fourMinutesAgo.toISO()
          },
          {
            id: 'IohvN',
            title: 'Instagram',
            password: 'qwerty',
            updatedAt: fourMinutesAgo.toISO()
          }
        ]
      }
    })

    describe('remote data timestamps is bigger', () => {
      beforeEach(() => {
        local.updatedAt = secondsAgo.toISO()
        remote.updatedAt = currentTime.toISO()
      })

      test('returns merged data with updated at timestamp', async () => {
        expect(mergeData(local, remote, cryptor)).toStrictEqual({
          entries: [
            {
              id: 'IohvN',
              title: 'Instagram',
              password: 'qwerty',
              updatedAt: fourMinutesAgo.toISO()
            },
            {
              id: 'SSsLF',
              title: 'Facebook',
              password: 'remotepassword',
              updatedAt: fourMinutesAgo.toISO()
            }
          ],
          updatedAt: currentTime.toISO()
        })
      })
    })

    describe('local data timestamp is bigger', () => {
      beforeEach(() => {
        local.updatedAt = currentTime.toISO()
        remote.updatedAt = secondsAgo.toISO()
      })

      test('returns merged data with updated at timestamp', async () => {
        expect(mergeData(local, remote, cryptor)).toStrictEqual({
          entries: [
            {
              id: 'SSsLF',
              title: 'Facebook',
              password: 'localpassword',
              updatedAt: fiveMinutesAgo.toISO()
            },
            {
              id: 'IohvN',
              title: 'Instagram',
              password: 'password',
              updatedAt: fourMinutesAgo.toISO()
            }
          ],
          updatedAt: currentTime.toISO()
        })
      })
    })
  })

  describe('missing entry', () => {
    describe('local storage is missing entry', () => {
      beforeEach(() => {
        local = {
          entries: [
            {
              id: 'poHuE',
              title: 'Instagram',
              password: 'password',
              updatedAt: fiveMinutesAgo.toISO()
            }
          ]
        }
        remote = {
          entries: [
            {
              id: 'SSsLF',
              title: 'Facebook',
              password: 'remotepassword',
              updatedAt: fourMinutesAgo.toISO()
            },
            {
              id: 'IohvN',
              title: 'Twitter',
              password: 'qwerty',
              updatedAt: fourMinutesAgo.toISO()
            }
          ]
        }
      })

      describe('remote data timestamp is bigger', () => {
        beforeEach(() => {
          local.updatedAt = secondsAgo.toISO()
          remote.updatedAt = currentTime.toISO()
        })

        test('adds element to entries array', async () => {
          expect(mergeData(local, remote, cryptor)).toStrictEqual({
            entries: [
              {
                id: 'SSsLF',
                title: 'Facebook',
                password: 'remotepassword',
                updatedAt: fourMinutesAgo.toISO()
              },
              {
                id: 'IohvN',
                title: 'Twitter',
                password: 'qwerty',
                updatedAt: fourMinutesAgo.toISO()
              }
            ],
            updatedAt: currentTime.toISO()
          })
        })
      })

      describe('local data timestamps is bigger', () => {
        beforeEach(() => {
          local.updatedAt = currentTime.toISO()
          remote.updatedAt = secondsAgo.toISO()
        })

        test('removes element from entries', async () => {
          expect(mergeData(local, remote, cryptor)).toStrictEqual({
            entries: [
              {
                id: 'poHuE',
                title: 'Instagram',
                password: 'password',
                updatedAt: fiveMinutesAgo.toISO()
              }
            ],
            updatedAt: currentTime.toISO()
          })
        })
      })
    })
  })

  describe('remote storage is missing entry', () => {
    beforeEach(() => {
      local = {
        entries: [
          {
            id: 'poHuE',
            title: 'Instagram',
            password: 'password',
            updatedAt: fiveMinutesAgo.toISO()
          },
          {
            id: 'SSsLF',
            title: 'Facebook',
            password: 'localpassword',
            updatedAt: fiveMinutesAgo.toISO()
          }
        ]
      }
      remote = {
        entries: [
          {
            id: 'IohvN',
            title: 'Twitter',
            password: 'qwerty',
            updatedAt: fourMinutesAgo.toISO()
          }
        ]
      }
    })

    describe('remote data timestamp is bigger', () => {
      beforeEach(() => {
        local.updatedAt = secondsAgo.toISO()
        remote.updatedAt = currentTime.toISO()
      })

      test('adds element to entries array', async () => {
        expect(mergeData(local, remote, cryptor)).toStrictEqual({
          entries: [
            {
              id: 'IohvN',
              title: 'Twitter',
              password: 'qwerty',
              updatedAt: fourMinutesAgo.toISO()
            }
          ],
          updatedAt: currentTime.toISO()
        })
      })
    })

    describe('local data timestamps is bigger', () => {
      beforeEach(() => {
        local.updatedAt = currentTime.toISO()
        remote.updatedAt = secondsAgo.toISO()
      })

      test('removes element from entries', async () => {
        expect(mergeData(local, remote, cryptor)).toStrictEqual({
          entries: [
            {
              id: 'poHuE',
              title: 'Instagram',
              password: 'password',
              updatedAt: fiveMinutesAgo.toISO()
            },
            {
              id: 'SSsLF',
              title: 'Facebook',
              password: 'localpassword',
              updatedAt: fiveMinutesAgo.toISO()
            }
          ],
          updatedAt: currentTime.toISO()
        })
      })
    })
  })
})
