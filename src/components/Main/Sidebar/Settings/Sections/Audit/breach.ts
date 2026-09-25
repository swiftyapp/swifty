import { setPref, runAudit } from '@/store'

// Breach monitoring decides what the audit reports, so flipping it re-runs the
// audit at once rather than leaving the old answer on screen.
export const setBreachCheck = (on: boolean) => {
  setPref('breachCheck', on)
  void runAudit()
}
