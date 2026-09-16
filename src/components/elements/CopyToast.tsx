import { useTranslation } from 'react-i18next'
import { useUi } from '@/store'

// The app-level "Copied to Clipboard" pill, raised by `services/copy`. Mounted
// from `Main` so copies from the palette and the standalone generator get
// feedback too. Mounting is what replays `animate-pop`, so every copy pops even
// while the pill from the previous one is still up. Centering uses auto margins
// so the pop's transform doesn't fight it.
//
// Not the shared `TOAST` token: that is a bordered card in a corner, this is a
// centered pill at the top.
export default function CopyToast() {
  const { t } = useTranslation()
  const copied = useUi(state => state.copied)

  if (!copied) return null

  return (
    <div
      data-testid="copy-toast"
      className="animate-pop fixed inset-x-0 top-4 z-50 mx-auto w-max rounded-full bg-text px-5 py-2 text-base text-detail shadow-float"
    >
      {t('Copied to Clipboard')}
    </div>
  )
}
