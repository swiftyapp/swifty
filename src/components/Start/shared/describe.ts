import type { SetupDriveFile } from '@/api/setup'
import type { Dates } from '@/utils/time'
import { humanSize } from '@/utils/size'

/**
 * The meta line under a found Drive pack: how recently another device wrote it,
 * and how much there is. Both are metadata Google already knows — nothing here
 * has been unsealed, and nothing here says what is inside. The date helpers are
 * the caller's (`useDates()`), so the line follows the pattern setting.
 */
export const describeDriveFile = (file: SetupDriveFile, { relativeLong }: Dates): string =>
  [relativeLong(file.modifiedTime), humanSize(file.size)].filter(Boolean).join(' · ')

/** The file name out of an OS path, for the backup the picker just handed back. */
export const fileNameOf = (path: string): string =>
  path.split(/[\\/]/).pop() || path
