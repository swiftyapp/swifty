// Where the photograph goes. The vault holds no photo, so the frame holds the
// silhouette every blank form prints there — shoulders cut by the frame's edge,
// as a passport photo is. It is what makes a face read as an ID at a glance
// rather than as a table of fields.
export default function Portrait() {
  return (
    <div
      aria-hidden
      className="flex aspect-[3/4] w-[84px] flex-none items-end justify-center overflow-hidden rounded-[6px] bg-black/6 text-(--face-ink) @max-[420px]:w-[64px]"
    >
      <svg viewBox="0 0 64 60" className="h-[72%] w-auto opacity-20" fill="currentColor">
        <circle cx="32" cy="17" r="14" />
        <path d="M4 60c0-15 12-26 28-26s28 11 28 26Z" />
      </svg>
    </div>
  )
}
