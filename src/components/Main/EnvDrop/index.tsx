import { useFileDrop } from '@/hooks/useFileDrop'
import { dropIdle } from './open'

// Mounted once by `Main`, like `Scan`: the drop target is the unlocked app as
// a whole. Desktop only by way of the hook — nothing is dropped on a phone.
// What a drop does, and when it declines, is `open.ts`.
export default function EnvDrop() {
  useFileDrop(paths => void dropIdle(paths))
  return null
}
