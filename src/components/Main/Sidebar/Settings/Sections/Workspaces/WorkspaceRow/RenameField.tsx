import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace } from '@/api/types'
import { refreshApp } from '@/store'
import { workspaceRename } from '@/api/workspace'
import { messageOf } from '@/api/errors'
import { workspaceLabel } from '@/lib/workspace'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import Kbd from '@/components/elements/Kbd'
import { inputClass } from '@/components/elements/formStyles'
import { META } from '@/components/elements/tokens'

interface Props {
  workspace: Workspace
  // The field folds away: renamed, or let go of with Escape.
  onDone: () => void
}

// A workspace's name, edited in its own row. Any workspace can be renamed, the
// locked ones included — the backend writes a locked vault's name into the
// registry, and the open one's into the vault as well so it travels.
export default function RenameField({ workspace, onDone }: Props) {
  const { t } = useTranslation()
  const label = workspaceLabel(workspace, t)
  const [name, setName] = useState(label)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = name.trim()

  // The probe is what carries names, so a rename is complete once it has been
  // re-read — the list and the header both redraw from it.
  const save = () => {
    if (!next || busy) return
    if (next === label) return onDone()
    setBusy(true)
    setError(null)
    workspaceRename(workspace.id, next)
      .then(refreshApp)
      .then(onDone)
      .catch((err: unknown) => {
        setError(messageOf(err))
        setBusy(false)
      })
  }

  return (
    <div data-testid="workspace-rename-row" className="animate-pop">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          autoFocus
          className={cx(inputClass, 'max-w-xs flex-1')}
          data-testid="workspace-rename-input"
          aria-label={t('Rename')}
          placeholder={label}
          value={name}
          disabled={busy}
          onFocus={event => event.currentTarget.select()}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') save()
            // The field owns Escape, or the one press would close Settings too.
            if (event.key === 'Escape') {
              event.stopPropagation()
              onDone()
            }
          }}
        />
        <Button
          size="md"
          testid="workspace-rename-save"
          disabled={!next}
          loading={busy}
          onClick={save}
        >
          {t('Save')}
        </Button>
      </div>
      <div className={cx(META, 'mt-2 flex items-center gap-1.5')}>
        <Kbd>⏎</Kbd> {t('save')} · <Kbd>esc</Kbd> {t('cancel')}
      </div>
      {error && (
        <p data-testid="workspace-rename-error" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  )
}
