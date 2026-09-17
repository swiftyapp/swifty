import { useTranslation } from 'react-i18next'
import type { SetupDriveFile } from '@/api/setup'
import { useDates } from '@/hooks/useDates'
import { describeDriveFile } from '@/utils/drivePack'
import RadioList from './RadioList'
import FoundFileCard from './FoundFileCard'

interface Props {
  /** Every vault the probe found, newest first. */
  files: SetupDriveFile[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * Which of the account's vaults this is about.
 *
 * More than one happens when separate installs have each synced their own
 * primary to the same account: two packs, two ids, and nothing but their dates
 * and sizes to tell them apart — so the choice is the user's, and it is made
 * before the password, which is per-vault. One vault is not a choice, so it is
 * shown rather than offered.
 *
 * Shared by the first run and by Settings › Workspaces, which pick a vault out
 * of the same probe for the same reason. They are never on screen together, so
 * the test ids are the same on both.
 */
export default function DriveVaults({ files, selectedId, onSelect }: Props) {
  const { t } = useTranslation()
  const dates = useDates()
  const file = files.find(candidate => candidate.id === selectedId) ?? null

  if (files.length > 1)
    return (
      <RadioList
        name={t('Vaults in this account')}
        testidPrefix="drive-vault"
        value={selectedId ?? ''}
        onChange={onSelect}
        options={files.map(vault => ({
          value: vault.id,
          label: t('Rowel vault'),
          meta: describeDriveFile(vault, dates)
        }))}
      />
    )

  return (
    file && (
      <FoundFileCard
        where="drive"
        testid="drive-found-file"
        name={t('Rowel vault')}
        meta={describeDriveFile(file, dates)}
        encrypted
      />
    )
  )
}
