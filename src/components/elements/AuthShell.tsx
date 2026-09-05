import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthMeta } from '@/hooks/useAuthMeta'
import Back from '@/assets/images/back.svg?react'
import { MONO_LABEL } from './tokens'

interface Props {
  children: ReactNode
  onBack?: () => void
}

// The shared full-height, centered auth ground: a neutral background (via the
// `bg-app` token, so it reads in both light and dark) with a soft radial glow
// behind a max-560px centered column, an optional bottom "Go Back" link and
// the mono footer strip (version + vault home, from useAuthMeta). Reused by
// the lock, setup and restore screens.
export default function AuthShell({ children, onBack }: Props) {
  const { t } = useTranslation()
  const meta = useAuthMeta()
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-app px-10 text-text select-none">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[44%] h-[700px] w-[1200px] max-w-none -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(closest-side, var(--topglow), transparent 70%)'
        }}
      />

      {/*
        Lock/setup/restore render without the Header, so without this strip the
        window has no drag region at all on these screens. It matches the
        Header's 38px height and sits under the traffic lights. It is painted
        before the panel below, so any panel content that reaches into the top
        strip keeps its own clicks -- only bare background drags the window.
      */}
      <div
        data-tauri-drag-region
        className="absolute inset-x-0 top-0 h-[38px]"
      />

      <div className="relative w-[560px] max-w-full">{children}</div>

      {onBack && (
        <button
          type="button"
          data-testid="go-back-button"
          onClick={onBack}
          className={`absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-1.5 border-0 bg-transparent ${MONO_LABEL} transition-colors hover:text-text`}
        >
          <Back width="13" className="[&_path]:fill-current" />
          {t('Go Back')}
        </button>
      )}

      {meta && (
        // A tier below text-xs on purpose: footer chrome, not content.
        <div className="absolute inset-x-0 bottom-0 flex h-13 items-center justify-center font-mono text-2xs uppercase tracking-label text-text3">
          {meta}
        </div>
      )}
    </div>
  )
}
