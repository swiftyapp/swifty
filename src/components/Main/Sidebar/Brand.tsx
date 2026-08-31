import logo from '@/assets/images/swifty.png'

// Single-vault app: the rail top is just a brand mark (no vault switcher).
export default function Brand() {
  return (
    <div
      className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-[11px]"
      style={{
        background: 'linear-gradient(150deg, var(--c-accent), #2b3a8f)',
        boxShadow: '0 1px 0 rgba(255,255,255,.18) inset'
      }}
      title="Swifty"
    >
      <img src={logo} alt="Swifty" className="h-6 w-6 object-contain" />
    </div>
  )
}
