import { describe, expect, it } from 'vitest'
import { hostPath, scopesOf, splitKey } from './keyInfo'

describe('splitKey', () => {
  it('reads the issuer prefix off the front of a key', () => {
    expect(splitKey('sk_live_51Hqx9Ab')).toEqual({ prefix: 'sk_live_', body: '51Hqx9Ab' })
    expect(splitKey('ghp_16C7e42F292c6912E7710c838347Ae178B4a')).toEqual({
      prefix: 'ghp_',
      body: '16C7e42F292c6912E7710c838347Ae178B4a'
    })
    expect(splitKey('sk-proj-abc123')).toEqual({ prefix: 'sk-proj-', body: 'abc123' })
  })

  it('stops at the first word that is not a word', () => {
    expect(splitKey('xoxb-1234-5678-abcd')).toEqual({ prefix: 'xoxb-', body: '1234-5678-abcd' })
  })

  it('has no prefix for a key that has none, or that is all prefix', () => {
    expect(splitKey('AKIAIOSFODNN7EXAMPLE')).toEqual({ prefix: '', body: 'AKIAIOSFODNN7EXAMPLE' })
    expect(splitKey('sk_live_')).toEqual({ prefix: '', body: 'sk_live_' })
    expect(splitKey('')).toEqual({ prefix: '', body: '' })
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
