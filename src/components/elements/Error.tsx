import { META_TYPE } from './tokens'
interface Props {
  error?: string | null
}

export default function Error({ error }: Props) {
  if (!error) return null
  return (
    <div
      data-testid="form-error"
      className={`mt-2.5 text-center ${META_TYPE} tracking-label text-bad`}
    >
      {error}
    </div>
  )
}
