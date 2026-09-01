import { cx } from '@/utils/cx'

// Mono uppercase eyebrow above each group of results ("Best match", "Entries",
// "Commands"). The first one sits tighter to the input hairline.
export default function Section({ label, first }: { label: string; first?: boolean }) {
  return (
    <div
      className={cx(
        'px-2.5 pb-1.5 font-mono text-xs uppercase tracking-label text-text3',
        first ? 'pt-2' : 'pt-3.5'
      )}
    >
      {label}
    </div>
  )
}
