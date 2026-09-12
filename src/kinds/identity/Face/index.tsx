import { useState } from 'react'
import { useFields } from '@/components/elements/fields'
import { docTypeOf, TEMPLATES, type IdentityKey } from '../templates'
import type { Doc } from './DocCell'
import Document from './Document'

/**
 * The document as an object — the read view of an identity.
 *
 * One face for every type (see `Document`), printing only the rows the
 * document's template has, so a value left over from another type (an import,
 * an older vault) never shows on a document that has no place for it. Reading
 * only: the editor keeps its labelled rows, where a type switch can reshape the
 * form and a date can explain its pattern.
 */
export default function Face() {
  const { entry } = useFields()
  const [shown, setShown] = useState(false)
  const docType = docTypeOf(entry)
  const keys = new Set<IdentityKey>(TEMPLATES[docType].map(row => row.key))

  const doc: Doc = {
    value: key => {
      const raw = keys.has(key) ? entry[key] : ''
      return typeof raw === 'string' ? raw.trim() : ''
    },
    shown,
    toggle: () => setShown(!shown)
  }

  return <Document docType={docType} doc={doc} />
}
