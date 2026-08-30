interface Props {
  error?: string | null
}

export default function Error({ error }: Props) {
  if (!error) return null
  return <div className="error-message">{error}</div>
}
