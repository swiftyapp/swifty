import { useState } from 'react'
import { t } from '@/i18n'
import type { RowError } from '@/lib/commands'

const MAX_SHOWN = 20

// A collapsible list of per-row parse errors. A bad row never aborts the batch,
// so this is informational — the good rows still import.
export default function RowErrors({ errors }: { errors: RowError[] }) {
  const [open, setOpen] = useState(false)
  if (errors.length === 0) return null

  return (
    <div className="row-errors">
      <span className="toggle danger" onClick={() => setOpen(!open)}>
        {errors.length} {t('rows could not be read')} {open ? '▾' : '▸'}
      </span>
      {open && (
        <ul>
          {errors.slice(0, MAX_SHOWN).map((e, i) => (
            <li key={i}>
              {t('Row')} {e.row}: {e.message}
            </li>
          ))}
          {errors.length > MAX_SHOWN && (
            <li>… {errors.length - MAX_SHOWN} {t('more')}</li>
          )}
        </ul>
      )}
    </div>
  )
}
