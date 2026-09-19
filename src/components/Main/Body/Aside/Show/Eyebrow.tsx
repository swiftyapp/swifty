import { useTranslation } from 'react-i18next'
import type { Entry, EntryMeta } from '@/api/types'
import { kindOf } from '@/kinds'
import { LABEL } from '@/components/elements/tokens'

interface Props {
  entry: EntryMeta
  /** The decrypted entry, or null while `revealEntry` is still in flight. */
  revealed: Entry | null
  /** How the line sits in the header the shell built around it. */
  className?: string
}

// What the entry is, in one micro line: the kind, and — once it can say so — the
// host it belongs to, or, for a document whose type is encrypted, what kind of
// document it is. Both shells draw it; only its place in the header differs.
export default function Eyebrow({ entry, revealed, className }: Props) {
  const { t } = useTranslation()
  const kind = kindOf(entry.type)
  // Whatever the kind can say about this entry — an identity's document type,
  // once the payload is in hand — and the host otherwise, which is metadata and
  // needs no reveal.
  const fromKind = revealed ? kind.eyebrow?.(revealed) : null
  const segment: { text: string; testid?: string } | null =
    fromKind ?? (entry.urlHost ? { text: entry.urlHost } : null)

  return (
    // On the phone it sits under the title as a plain 13px line rather than a
    // tracked uppercase label — the prototype's "aws.amazon.com · Work".
    <div className={`${className} ${LABEL} max-md:text-base max-md:normal-case max-md:tracking-[0]`}>
      <span className="text-text2">{t(kind.label)}</span>
      {segment && (
        <>
          <span>·</span>
          <span data-testid={segment.testid}>{segment.text}</span>
        </>
      )}
    </div>
  )
}
