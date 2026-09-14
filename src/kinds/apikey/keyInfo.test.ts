import { describe, expect, it } from 'vitest'
import { hostPath, scopesOf, splitKey } from './keyInfo'

describe('splitKey', () => {
  it('reads a known issuer prefix off the front of a key', () => {
    expect(splitKey('sk_live_51Hqx9Ab')).toEqual({ prefix: 'sk_live_', body: '51Hqx9Ab' })
    expect(splitKey('ghp_16C7e42F292c6912E7710c838347Ae178B4a')).toEqual({
      prefix: 'ghp_',
      body: '16C7e42F292c6912E7710c838347Ae178B4a'
    })
    expect(splitKey('xoxb-1234-5678-abcd')).toEqual({ prefix: 'xoxb-', body: '1234-5678-abcd' })
    expect(splitKey('AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY')).toEqual({
      prefix: 'AIza',
      body: 'SyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY'
    })
  })

  // `sk-proj-` before `sk-ant-`, and never `abcd_` after `sk_live_`: the prefix
  // is the one the issuer stamps, whole, and nothing past it.
  it('takes the longest known prefix and nothing beyond it', () => {
    expect(splitKey('sk-proj-abc123')).toEqual({ prefix: 'sk-proj-', body: 'abc123' })
    expect(splitKey('sk-ant-api03-abc')).toEqual({ prefix: 'sk-ant-', body: 'api03-abc' })
    expect(splitKey('sk_live_abcd_efgh')).toEqual({ prefix: 'sk_live_', body: 'abcd_efgh' })
  })

  // Nothing is guessed from punctuation: a dash or underscore in an unknown
  // format may sit inside the secret, so the whole key stays masked.
  it('masks a key of an unknown format whole', () => {
    expect(splitKey('deadbeef-1234-4abc-8def-123456789abc')).toEqual({
      prefix: '',
      body: 'deadbeef-1234-4abc-8def-123456789abc'
    })
    expect(splitKey('cpl_live_4f9a0b3c')).toEqual({ prefix: '', body: 'cpl_live_4f9a0b3c' })
    expect(splitKey('alpha-beta-SECRET')).toEqual({ prefix: '', body: 'alpha-beta-SECRET' })
    expect(splitKey('AKIAIOSFODNN7EXAMPLE')).toEqual({ prefix: '', body: 'AKIAIOSFODNN7EXAMPLE' })
    expect(splitKey('')).toEqual({ prefix: '', body: '' })
  })

  it('has no prefix for a key that is only a prefix', () => {
    expect(splitKey('sk_live_')).toEqual({ prefix: '', body: 'sk_live_' })
  })
})

describe('scopesOf', () => {
  it('splits on whatever the scopes were separated with', () => {
    expect(scopesOf('read:user repo')).toEqual(['read:user', 'repo'])
    expect(scopesOf('read, write,admin')).toEqual(['read', 'write', 'admin'])
    expect(scopesOf('  data.read\n\ndata.write  ')).toEqual(['data.read', 'data.write'])
    expect(scopesOf('')).toEqual([])
  })
})

describe('hostPath', () => {
  it('drops the scheme and a trailing slash, keeps the path', () => {
    expect(hostPath('https://api.coupler.io/v1/')).toBe('api.coupler.io/v1')
    expect(hostPath('https://api.stripe.com')).toBe('api.stripe.com')
    expect(hostPath('http://localhost:8080/api')).toBe('localhost:8080/api')
  })

  it('shows what is not a URL as it is', () => {
    expect(hostPath('internal gateway')).toBe('internal gateway')
  })
})
