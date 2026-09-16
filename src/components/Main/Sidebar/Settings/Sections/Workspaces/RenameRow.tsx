import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp, selectWorkspaces, selectActiveWorkspace, refreshApp } from '@/store'
import { workspaceRename } from '@/api/workspace'
import { messageOf } from '@/api/errors'
import { workspaceLabel } from '@/lib/workspace'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'

export default function RenameRow() {
  const { t } = useTranslation()
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = list.find(workspace => workspace.id === active)
  if (!current) return null

  const next = name.trim()

  // The probe is what carries names, so a rename is complete once it has been
  // re-read — the list and the header both redraw from it.
  const save = () => {
    if (!next || busy) return
    setBusy(true)
    setError(null)
    workspaceRename(current.id, next)
      .then(refreshApp)
      .then(() => setName(''))
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false))
  }

  return (
    <SettingsRow label={t('Name')} testid="workspace-rename-row">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          className={`${inputClass} max-w-xs`}
          data-testid="workspace-rename-input"
          placeholder={workspaceLabel(current, t)}
          value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && save()}
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
        {error && (
          <span data-testid="workspace-rename-error" className="text-base text-bad">
            {error}
          </span>
        )}
      </div>
    </SettingsRow>
  )
}
