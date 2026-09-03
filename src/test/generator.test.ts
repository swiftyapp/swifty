import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generatePassword } from '@/lib/commands'
import {
  charset,
  defaultSettings,
  entropy,
  generate,
  memorable,
  persistDefaults,
  type GeneratorSettings
} from '@/services/generator'
import WORDS from '@/services/wordlist'

const settings = (overrides: Partial<GeneratorSettings> = {}): GeneratorSettings => ({
  ...defaultSettings(),
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('wordlist', () => {
  it('is 256 distinct words, so each carries exactly 8 bits', () => {
    expect(WORDS).toHaveLength(256)
    expect(new Set(WORDS).size).toBe(256)
  })
})

describe('charset', () => {
  it('always keeps both letter cases', () => {
    expect(charset(settings({ symbols: false, numbers: false }))).toHaveLength(52)
  })

  it('adds digits and symbols only when they are toggled on', () => {
    expect(charset(settings({ symbols: false, numbers: true }))).toHaveLength(62)
    expect(charset(settings({ symbols: true, numbers: false }))).toHaveLength(82)
    expect(charset(settings({ symbols: true, numbers: true }))).toHaveLength(92)
  })

  it('drops look-alike characters when asked', () => {
    const pool = charset(settings({ symbols: false, numbers: true, excludeSimilar: true }))
    expect([...'il1Lo0O'].some(char => pool.includes(char))).toBe(false)
    expect(pool).toHaveLength(55)
  })
})

describe('generate (random)', () => {
  it('asks the engine for the chosen length and charset', async () => {
    await generate(settings({ length: 32, symbols: false, numbers: true }))
    expect(generatePassword).toHaveBeenCalledWith({
      length: 32,
      numbers: true,
      symbols: false,
      uppercase: true,
      lowercase: true,
      excludeSimilarCharacters: false,
      strict: true
    })
  })

  it('forwards the look-alike exclusion', async () => {
    await generate(settings({ excludeSimilar: true }))
    expect(generatePassword).toHaveBeenCalledWith(
      expect.objectContaining({ excludeSimilarCharacters: true })
    )
  })
})

describe('memorable', () => {
  it('joins the requested number of words with a two-digit suffix', () => {
    const value = memorable(settings({ mode: 'memorable', words: 4, numbers: true }))
    const parts = value.split('-')
    expect(parts).toHaveLength(5)
    expect(parts.slice(0, 4).every(word => WORDS.includes(word))).toBe(true)
    expect(parts[4]).toMatch(/^\d{2}$/)
  })

  it('drops the suffix when numbers are off', () => {
    const parts = memorable(
      settings({ mode: 'memorable', words: 6, numbers: false })
    ).split('-')
    expect(parts).toHaveLength(6)
    expect(parts.every(word => WORDS.includes(word))).toBe(true)
  })

  it('capitalizes every word when asked', () => {
    const value = memorable(
      settings({ mode: 'memorable', words: 3, numbers: false, capitalize: true })
    )
    expect(value.split('-').every(word => /^[A-Z][a-z]+$/.test(word))).toBe(true)
  })

  it('does not repeat itself', () => {
    const options = settings({ mode: 'memorable', words: 5, numbers: true })
    const draws = new Set(Array.from({ length: 20 }, () => memorable(options)))
    expect(draws.size).toBe(20)
  })

  it('is routed through generate without touching the engine', async () => {
    const value = await generate(settings({ mode: 'memorable', words: 3 }))
    expect(value.split('-').length).toBeGreaterThanOrEqual(3)
    expect(generatePassword).not.toHaveBeenCalled()
  })
})

describe('entropy', () => {
  it('scales with the charset and the length', () => {
    expect(entropy(settings({ length: 20 })).bits).toBe(130)
    expect(entropy(settings({ length: 20, symbols: false, numbers: false })).bits).toBe(114)
    expect(entropy(settings({ length: 8, symbols: false, numbers: false })).bits).toBe(46)
  })

  it('counts eight bits per word plus the suffix', () => {
    expect(entropy(settings({ mode: 'memorable', words: 5, numbers: false })).bits).toBe(40)
    expect(entropy(settings({ mode: 'memorable', words: 5, numbers: true })).bits).toBe(47)
  })

  it('maps bits onto the five meter segments', () => {
    expect(entropy(settings({ length: 8, symbols: false, numbers: false })).level).toBe(2)
    expect(entropy(settings({ length: 20 })).level).toBe(4)
    expect(entropy(settings({ mode: 'memorable', words: 3, numbers: false })).level).toBe(0)
  })
})

describe('defaultSettings', () => {
  it('clamps the stored default length into the slider range', () => {
    localStorage.setItem(
      'swifty:generatorDefaults',
      JSON.stringify({ length: 60, numbers: false, symbols: true, uppercase: true })
    )
    const initial = defaultSettings()
    expect(initial.length).toBe(48)
    expect(initial.numbers).toBe(false)
    expect(initial.symbols).toBe(true)
    expect(initial.mode).toBe('random')
  })

  it('round-trips the look-alike exclusion through persistDefaults', () => {
    persistDefaults(settings({ excludeSimilar: true }))
    expect(defaultSettings().excludeSimilar).toBe(true)
  })
})
