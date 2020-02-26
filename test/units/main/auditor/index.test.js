import { Cryptor } from '@swiftyapp/cryptor'
import { encrypt } from 'main/application/helpers/encryption'
import Auditor from 'main/application/auditor'

let auditor
Date.now = jest.fn(() => 1568926362163) // Thu Sep 19 2019 22:52:42 GMT+0200 (Central European Summer Time)

describe('Auditor', () => {
  let data = {
    entries: [
      {
        id: 'xId5d4fa', // abcdfg12
        password:
          '5b8732b107725d3f75d2e6b111dd27782bcb3b95d88feb6901d968a094be309792c146773b03247976af97a4a77d7c90904d5d70d166fbcdedcafa9e75f9e64084969720b3057a5018a0533cf38a97e10ad428be9a0142ca684f163bd55a98a40c925ecb03840ebc',
        password_updated_at: '2019-09-16T21:02:58.588Z'
      },
      {
        id: 'xId5d4fb', // short12
        password:
          '5eace3bbcc1e426d2c6ba4ab7e2fcbe68c37a236a17cfb91e029b82e85edce69571ec0d12f42273e7a40da68c364ded5ce1526ee2e75bf86ce37ddf8bcf116c2bdbfa88d3fd63ba992ff44fb6438ebe54ee351849792912d3da552b60cdc1edd0b54f678a98700',
        password_updated_at: '2019-09-12T20:00:53.588Z'
      },
      {
        id: 'xId5d4fc', // n0taw33kpass!
        password:
          '3686da0e0243fceac0daca117f7099e21683756e5f75580bc581234f5b8b11d82cdaa65a735eec9d163c2ffa1c36e92efc6465b4e9b6363a2f68c13471c5f7881e239026f925e585a3d1c60674e5deed3e2dfef5b5da306fb9cddbfc5d0268cb06f818450e68057ad1a8a82cdd',
        password_updated_at: '2019-06-15T20:00:53.588Z'
      },
      {
        id: 'xId5d4fd', // n0tAw33kpAsS!
        password:
          '93ac3f20d654f8a5a93aab8d576d5b264c2eb695b3da9a470a6bb38fb7614aea7fe2f3e70060842bfd644c70475b3f8f454328b749f9c7a298de71fc93cd9d07bb42d45bc591317b494b6e19f6a11189123ef18894e7dd030442884cbe8a1ab6f1bfed98ba07da191b2e317fbf',
        password_updated_at: '2019-06-21T21:02:59.588Z'
      },
      {
        id: 'xId5d4fe', // abcdfg12
        password:
          '5b8732b107725d3f75d2e6b111dd27782bcb3b95d88feb6901d968a094be309792c146773b03247976af97a4a77d7c90904d5d70d166fbcdedcafa9e75f9e64084969720b3057a5018a0533cf38a97e10ad428be9a0142ca684f163bd55a98a40c925ecb03840ebc',
        password_updated_at: '2019-09-16T21:02:58.588Z'
      }
    ]
  }
  afterEach(() => {
    jest.clearAllMocks()
  })

  beforeEach(() => {
    let cryptor = new Cryptor('password')
    auditor = new Auditor(encrypt(data, cryptor), cryptor)
  })

  test('#getAudit', () => {
    return auditor.getAudit().then(data => {
      expect(data).toEqual({
        xId5d4fa: {
          hash:
            '5FlHAQQZrv2Su8myp5uybeZgCDrHVEm0+NgPcKYWYonQJnS8yoRn5+qLRdxxLnLfSCwbFvIKTtJ2HiGlTHuRWg==',
          isShort: false,
          isOld: false,
          isRepeating: true,
          isWeak: true
        },
        xId5d4fb: {
          hash:
            'rOju4uxx15uzf1iR3tWbIFi7fPaZZw+85j1zl18ZUtjfV/TBBwoW6pqnsRFAaoGq8FPR6GZ5w94tzG8KZEFVaw==',
          isShort: true,
          isOld: false,
          isRepeating: false,
          isWeak: true
        },
        xId5d4fc: {
          hash:
            'mGLRETKvzrn44l5HyVJH5yTtph4PhLGhpZsMEAHKxpJj5fsMw+9MPApeVnl3YkWQMW1KM0rOk5C4WWw++UhFlQ==',
          isShort: false,
          isOld: true,
          isRepeating: false,
          isWeak: true
        },
        xId5d4fd: {
          hash:
            '2hArtT6Plrf9+VlUPdhyOv0UPr/ZTMuyeR/a5/vqnB/o6Klm9rQSNwNtU4c/ApdZGjG8iFxuloNQvQEJDSym2w==',
          isShort: false,
          isOld: false,
          isRepeating: false,
          isWeak: false
        },
        xId5d4fe: {
          hash:
            '5FlHAQQZrv2Su8myp5uybeZgCDrHVEm0+NgPcKYWYonQJnS8yoRn5+qLRdxxLnLfSCwbFvIKTtJ2HiGlTHuRWg==',
          isShort: false,
          isOld: false,
          isRepeating: true,
          isWeak: true
        }
      })
    })
  })
})
