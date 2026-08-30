import type { ChangeEvent, KeyboardEvent } from 'react'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import Error from './Error'
import Touchid from '@/assets/images/touchid.svg?react'

interface Props {
  error?: string | null
  touchID?: boolean
  placeholder?: string
  onEnter?: (value: string) => void
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  onTouchID?: () => void
}

export default function Masterpass({
  error,
  touchID,
  placeholder,
  onEnter,
  onChange,
  onTouchID
}: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.currentTarget.value !== '') {
      onEnter?.(event.currentTarget.value)
    }
  }

  return (
    <div className={cx('masterpass-input', { error: !!error })}>
      <Error error={error} />
      <input
        type="password"
        maxLength={24}
        placeholder={placeholder || t('Master Password')}
        onChange={onChange}
        onKeyDown={handleKeyDown}
      />
      {touchID && (
        <Touchid
          width="32"
          height="32"
          className="touchid"
          onClick={onTouchID}
        />
      )}
    </div>
  )
}
