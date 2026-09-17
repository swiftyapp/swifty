import { shareRevoke } from '@/api/share'
import { useUi, dropOrphan } from '@/store'

// Take back every orphaned share that can be taken back now. One failing does
// not stop the rest, and whatever still fails stays queued for the next
// surface that calls this.
export const revokeOrphans = async () => {
  await Promise.all(
    useUi.getState().orphans.map(fileId =>
      shareRevoke(fileId)
        .then(() => dropOrphan(fileId))
        .catch(() => {})
    )
  )
}
