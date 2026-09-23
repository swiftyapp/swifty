import { useVaultMeta } from '@/hooks/useAuthMeta'
import { META_TYPE } from './tokens'
import SyncIndicator from './SyncIndicator'

// The lock screen's footer strip: where the vault lives as a glyph, and the
// version beside it. Chrome, not content — plain meta type, no label casing,
// and no app name, which the wordmark above already says.
export default function AuthFooter() {
  const meta = useVaultMeta()
  if (!meta) return null
  return (
    <div className="flex items-center gap-1.5">
      <SyncIndicator side="top" />
      {meta.version && (
        <span data-testid="auth-version" className={`${META_TYPE} text-text2`}>
          {meta.version}
        </span>
      )}
    </div>
  )
}
