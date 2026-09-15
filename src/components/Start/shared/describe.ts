import type { SetupDriveFile } from '@/api/setup'
import { relativeLong } from '@/utils/time'
import { humanSize } from '@/utils/size'

/**
 * The meta line under a found Drive pack: how recently another device wrote it,
 * and how much there is. Both are metadata Google already knows — nothing here
 * has been unsealed, and nothing here says what is inside.
 */
export const describeDriveFile = (file: SetupDriveFile): string =>
  [relativeLong(file.modifiedTime), humanSize(file.size)].filter(Boolean).join(' · ')

/** The file name out of an OS path, for the backup the picker just handed back. */
export const fileNameOf = (path: string): string =>
  path.split(/[\\/]/).pop() || path
