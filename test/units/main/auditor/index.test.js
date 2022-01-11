import { Cryptor } from 'application/cryptor'
import Auditor from 'application/auditor'

// running tests with real encryption
jest.unmock('@swiftyapp/aes-256-gcm')
jest.unmock('application/cryptor')

let auditor
Date.now = jest.fn(() => 1568926362163) // Thu Sep 19 2019 22:52:42 GMT+0200 (Central European Summer Time)

describe('Auditor', () => {
  let data = {
    contents: [
      {
        id: 'xId5d4fa', // abcdfg12
        password:
          '8a4bb94a2788587152cfcd52e6441076f2c40ecc6c2a21b6962495fbf6ceedfe481ecdc15987b9d434f4b9ef1e1572e96ecd53cc',
        password_updated_at: '2019-09-16T21:02:58.588Z'
      },
      {
        id: 'xId5d4fb', // short12
        password:
          'b0431264c636d6810a0704abd33d84a241ffa23a22aa7d04a60345c67de40a5ce5fff9361e1d4f7d1457a3977774509eb815fd',
        password_updated_at: '2019-09-12T20:00:53.588Z'
      },
      {
        id: 'xId5d4fc', // n0taw33kpass!
        password:
          '14b09f8dceb73a8e364ba9614a04fc1cb4f55debfc21388a597e86dcd75f5a2862079ace2e4876e32f4135bcbadc5c36ed1957a052a5a4a7a1',
        password_updated_at: '2019-06-15T20:00:53.588Z'
      },
      {
        id: 'xId5d4fd', // n0tAw33kpAsS!
        password:
          'cce8709efc1ed63c381f00a5edf1f968465b1c633d4f2fdddf13537e947c12c41b0883457c16c8ea77f0c7681a33dcdb5e055a0dd2a0953c76',
        password_updated_at: '2019-06-21T21:02:59.588Z'
      },
      {
        id: 'xId5d4fe', // abcdfg12
        password:
          '8a4bb94a2788587152cfcd52e6441076f2c40ecc6c2a21b6962495fbf6ceedfe481ecdc15987b9d434f4b9ef1e1572e96ecd53cc',
        password_updated_at: '2019-09-16T21:02:58.588Z'
      }
    ]
  }

  beforeEach(() => {
    let cryptor = new Cryptor('password')
    auditor = new Auditor(JSON.stringify(data), cryptor)
  })

  test('#getAudit', () => {
    return auditor.getAudit().then(data => {
      expect(data).toEqual({
        xId5d4fa: {
          hash: '5FlHAQQZrv2Su8myp5uybeZgCDrHVEm0+NgPcKYWYonQJnS8yoRn5+qLRdxxLnLfSCwbFvIKTtJ2HiGlTHuRWg==',
          isShort: false,
          isOld: false,
          isRepeating: true,
          isWeak: true
        },
        xId5d4fb: {
          hash: 'rOju4uxx15uzf1iR3tWbIFi7fPaZZw+85j1zl18ZUtjfV/TBBwoW6pqnsRFAaoGq8FPR6GZ5w94tzG8KZEFVaw==',
          isShort: true,
          isOld: false,
          isRepeating: false,
          isWeak: true
        },
        xId5d4fc: {
          hash: 'mGLRETKvzrn44l5HyVJH5yTtph4PhLGhpZsMEAHKxpJj5fsMw+9MPApeVnl3YkWQMW1KM0rOk5C4WWw++UhFlQ==',
          isShort: false,
          isOld: true,
          isRepeating: false,
          isWeak: true
        },
        xId5d4fd: {
          hash: '2hArtT6Plrf9+VlUPdhyOv0UPr/ZTMuyeR/a5/vqnB/o6Klm9rQSNwNtU4c/ApdZGjG8iFxuloNQvQEJDSym2w==',
          isShort: false,
          isOld: false,
          isRepeating: false,
          isWeak: false
        },
        xId5d4fe: {
          hash: '5FlHAQQZrv2Su8myp5uybeZgCDrHVEm0+NgPcKYWYonQJnS8yoRn5+qLRdxxLnLfSCwbFvIKTtJ2HiGlTHuRWg==',
          isShort: false,
          isOld: false,
          isRepeating: true,
          isWeak: true
        }
      })
    })
  })
})
