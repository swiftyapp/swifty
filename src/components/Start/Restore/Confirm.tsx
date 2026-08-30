import { useState, type ChangeEvent } from 'react'
import { useAppDispatch } from '@/store'
import { restoreBackup } from '@/store/thunks'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'

interface Props {
  display: boolean
  path: string
}

export default function Confirm({ display, path }: Props) {
  const dispatch = useAppDispatch()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const onSend = () => {
    dispatch(restoreBackup(path, password)).catch(() =>
      setError(t('Invalid password for backup'))
    )
  }

  if (!display) return null

  return (
    <>
      <Masterpass
        placeholder={t('Enter Master Password')}
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onSend}>
        {t('Finish')}
      </div>
    </>
  )
}
