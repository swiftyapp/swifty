// What `useDelete` has to say when the archive did not go through, drawn where
// the shell has room for it — under the rows on the desktop, under the footer
// on the phone. Nothing to say is nothing to draw.
export default function DeleteError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="mt-3 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad">
      {error}
    </div>
  )
}
