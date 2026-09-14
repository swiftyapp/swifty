import type { TKey } from '@/i18n'

// Where a key is honoured. Two values, the way issuers cut them: a test key
// does nothing that costs money or reaches a customer, a production one does.
export const ENVIRONMENTS = ['test', 'production'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

export const ENVIRONMENT_LABELS: Record<Environment, TKey> = {
  test: 'Test',
  production: 'Production'
}

/**
 * The stored value as an environment, or null for anything else — an unset
 * row, an import's free text. Nothing is guessed from it.
 */
export const environmentOf = (value: unknown): Environment | null =>
  ENVIRONMENTS.find(environment => environment === value) ?? null
