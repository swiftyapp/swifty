import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import AuditList from '@/components/Main/Body/List/Audit'
import AuditAside from '@/components/Main/Body/Aside/Audit'
import type { Audit } from '@/lib/commands'
import { makeStore, setBreachCheck } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

const audit: Audit = {
  l1: { score: 0, isWeak: true, isRepeating: false, breached: false },
  l2: { score: 2, isWeak: false, isRepeating: true, breached: true }
}

const seed = () => {
  const store = makeStore()
  withEntries(
    store,
    [loginMeta({ id: 'l1', title: 'Weakling' }), loginMeta({ id: 'l2', title: 'Reuser' })],
    audit
  )
  return store
}

describe('Audit list', () => {
  it('groups entries by weakness and reuse', () => {
    renderWithStore(<AuditList />, { store: seed() })
    expect(screen.getByText('Weak')).toBeInTheDocument()
    expect(screen.getByText('Weakling')).toBeInTheDocument()
    expect(screen.getByText('Reused')).toBeInTheDocument()
    expect(screen.getByText('Reuser')).toBeInTheDocument()
  })

  it('hides breached results until the breach check is enabled', () => {
    renderWithStore(<AuditList />, { store: seed() })
    expect(screen.queryByText('Breached')).not.toBeInTheDocument()
  })

  it('shows breached results when the breach check is enabled', () => {
    const store = seed()
    setBreachCheck(true)
    renderWithStore(<AuditList />, { store })
    expect(screen.getByText('Breached')).toBeInTheDocument()
    setBreachCheck(false)
  })

  it('shows a loading state before results arrive', () => {
    const store = makeStore()
    withEntries(store, [loginMeta()])
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
