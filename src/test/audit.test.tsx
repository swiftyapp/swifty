import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import AuditList from '@/components/Main/Body/List/Audit'
import AuditAside from '@/components/Main/Body/Aside/Audit'
import type { Audit } from '@/lib/commands'
import { makeStore } from '@/store'
import { renderWithStore, withEntries, loginEntry } from './utils'

const audit: Audit = {
  l1: { isWeak: true, isShort: false, isOld: false, isRepeating: false },
  l2: { isWeak: false, isShort: true, isOld: false, isRepeating: false }
}

const seed = () => {
  const store = makeStore()
  withEntries(
    store,
    [loginEntry({ id: 'l1', title: 'Weakling' }), loginEntry({ id: 'l2', title: 'Shorty' })],
    audit
  )
  return store
}

describe('Audit list', () => {
  it('groups entries by weakness', () => {
    renderWithStore(<AuditList />, { store: seed() })
    expect(screen.getByText('Weak')).toBeInTheDocument()
    expect(screen.getByText('Weakling')).toBeInTheDocument()
    expect(screen.getByText('Short')).toBeInTheDocument()
    expect(screen.getByText('Shorty')).toBeInTheDocument()
  })

  it('shows a loading state before results arrive', () => {
    const store = makeStore()
    withEntries(store, [loginEntry()])
    renderWithStore(<AuditList />, { store })
    expect(screen.getByText('Loading Results..')).toBeInTheDocument()
  })
})

describe('Audit aside', () => {
  it('renders the score and counts', () => {
    renderWithStore(<AuditAside />, { store: seed() })
    expect(screen.getByText('Password Audit')).toBeInTheDocument()
    expect(screen.getByText('Overall Score')).toBeInTheDocument()
  })
})
