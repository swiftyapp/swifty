import { describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DOC_TYPES, TEMPLATES, type DocType, type IdentityKey } from '../templates'
import type { Doc } from './DocCell'
import Document from './Document'

// A document holding every field, filtered by its own template exactly as the
// face's own reader does — so a type never prints a value it has no row for.
const FILLED: Record<string, string> = {
  name: 'Alexandra Marie Reinholt',
  number: 'X48213097',
  country: 'GBR',
  nationality: 'GBR',
  birth_date: '1991-03-14',
  sex: 'F',
  issue_date: '2021-06-02',
  expiry_date: '2031-06-01',
  authority: 'HMPO',
  personal_number: '9103140447'
}

const show = (docType: DocType, shown = false, over: Record<string, string> = {}) => {
  const keys = new Set<IdentityKey>(TEMPLATES[docType].map(row => row.key))
  const doc: Doc = {
    value: key => (keys.has(key) ? ({ ...FILLED, ...over }[key] ?? '') : ''),
    shown,
    toggle: () => {}
  }
  render(<Document docType={docType} doc={doc} />)
}

const face = () => screen.getByTestId('identity-face')

describe('the document face', () => {
  it('prints every kind of document on the same paper', () => {
    for (const docType of DOC_TYPES) {
      show(docType)
      expect(face()).toHaveAttribute('data-doc-type', docType)
      expect(screen.getByTestId('entry-value-name')).toHaveTextContent('Alexandra')
      cleanup()
    }
  })

  it('prints no row the document has no place for', () => {
    // A licence template carries no nationality; the value is there to be read
    // and the face still has to leave it off.
    show('driver_license')
    expect(screen.queryByTestId('entry-value-nationality')).toBeNull()
    expect(screen.getByTestId('entry-value-number')).toBeInTheDocument()
  })

  it('says how long the document has, once', () => {
    show('passport', false, { expiry_date: '2019-01-01' })
    expect(screen.getAllByText('Expired')).toHaveLength(1)
  })

  it('says nothing about validity where there is no expiry', () => {
    show('other', false, { expiry_date: '' })
    expect(screen.queryByText('Expired')).toBeNull()
  })

  it('keeps the secrets masked until the eye is pressed', () => {
    show('passport')
    expect(screen.getByTestId('entry-value-number')).not.toHaveTextContent('X48213097')
    // The band is generated from the same values and must not undo the mask.
    expect(face().textContent).not.toContain('X48213097')
    expect(face().textContent).not.toContain('9103140447')
  })

  it('prints the number and its band once revealed', () => {
    show('passport', true)
    expect(screen.getByTestId('entry-value-number')).toHaveTextContent('X48213097')
    expect(face().textContent).toContain('P<GBRALEXANDRA')
  })
})
