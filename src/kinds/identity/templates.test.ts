import { describe, it, expect } from 'vitest'
import { DOC_TYPES, docTypeOf, droppedKeys, specOf, TEMPLATES } from './templates'

describe('TEMPLATES', () => {
  // Every document is at least a name and a number, and every row it lists has
  // to have somewhere to render from.
  it('describes every document type it declares', () => {
    for (const type of DOC_TYPES) {
      const rows = TEMPLATES[type]
      expect(rows.map(row => row.key)).toContain('name')
      expect(rows.map(row => row.key)).toContain('number')
      for (const row of rows) expect(specOf(row.key)).toBeDefined()
      // A duplicated key would render the same draft field twice.
      expect(new Set(rows.map(row => row.key)).size).toBe(rows.length)
    }
  })
})

describe('docTypeOf', () => {
  it('reads the draft’s type, or falls back to a passport', () => {
    expect(docTypeOf({ type: 'identity', title: '', doc_type: 'id_card' })).toBe('id_card')
    expect(docTypeOf({ type: 'identity', title: '' })).toBe('passport')
    expect(docTypeOf({ type: 'identity', title: '', doc_type: 'spaceship' })).toBe('passport')
  })
})

describe('droppedKeys', () => {
  // A licence has no nationality or personal number, so switching to one has to
  // report both — the editor clears them so a hidden row cannot save a value.
  it('reports what the target document has no room for', () => {
    expect(droppedKeys('passport', 'driver_license')).toEqual([
      'nationality',
      'sex',
      'personal_number'
    ])
    expect(droppedKeys('driver_license', 'passport')).toEqual([])
  })

  it('drops nothing when the type does not change', () => {
    for (const type of DOC_TYPES) expect(droppedKeys(type, type)).toEqual([])
  })
})
