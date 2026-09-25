import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createWorkspace, selectWorkspaces, useApp } from '@/store'
import { describeError } from '@/api/errors'
import { workspaceLabel } from '@/lib/workspace'
import { firstUnusedColor, type WorkspaceColor } from '@/lib/workspaceColor'
import { cx } from '@/utils/cx'
import Masterpass from '@/components/elements/Masterpass'
import { CARD, LABEL } from '@/components/elements/tokens'
import SubpageFrame from '../../../SubpageFrame'
import WorkspaceForm from '../WorkspaceForm'
import { nameTaken } from '../WorkspaceForm/nameTaken'

// Creating a second (or third) encrypted database. There is one master
// password for the device, so the form asks for it rather than for a new one:
// the backend proves it against the primary before creating anything, which
// is what keeps every workspace under the same password — and what lets the
// whole app open with one unlock. A wrong one is the unlock's own error.
//
// Creating opens the new workspace immediately: `workspace_create` hands back
// an unlocked session, so Settings is left behind by the flow change rather
// than closed here.
export default function NewWorkspaceSubpage() {
  const { t } = useTranslation()
  const workspaces = useApp(selectWorkspaces)
  // A new workspace joins the open one's Drive account.
  const syncs = useApp(state => state.sync.configured)
  const [name, setName] = useState('')
  const [color, setColor] = useState<WorkspaceColor>(() =>
    firstUnusedColor(workspaces.map(workspace => workspace.color))
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const label = name.trim()
  const taken = workspaces.map(workspace => workspaceLabel(workspace, t))
  const ready = !!label && !nameTaken(label, taken) && !!password

  // The fields are read once here and held while busy, so what is created is
  // exactly what is on screen.
  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      await createWorkspace(label, password, color)
    } catch (err: unknown) {
      setBusy(false)
      setError(describeError(err) || t('Something went wrong'))
    }
  }

  const meta = syncs
    ? `${t('Empty · encrypted')} · ${t('Syncs to Google Drive')}`
    : t('Empty · encrypted')

  return (
    <SubpageFrame
      footer={{
        hint: ready ? t('Ready') : t('Name and master password required'),
        cta: t('Create workspace'),
        disabled: !ready,
        loading: busy,
        // The frame's Enter covers the password field too: its own onEnter
        // would submit a second time on the same key.
        onSubmit: () => void submit(),
        testid: 'workspace-create'
      }}
    >
      <WorkspaceForm
        name={name}
        onName={setName}
        color={color}
        onColor={setColor}
        taken={taken}
        preview={{ seed: 'new', meta }}
        disabled={busy}
        testidPrefix="workspace-new"
      />
      <div className={cx(LABEL, 'mt-6 mb-2')}>{t("Confirm it's you")}</div>
      <div className={cx(CARD, 'p-4')}>
        <Masterpass
          placeholder={t('Master password')}
          testid="workspace-new-password"
          autoFocus={false}
          pending={busy}
          error={error}
          onChange={event => {
            setError(null)
            setPassword(event.currentTarget.value)
          }}
        />
        <p className="mt-2 text-sm text-text2">
          {t('The new workspace is sealed with your existing master password.')}
        </p>
      </div>
    </SubpageFrame>
  )
}
