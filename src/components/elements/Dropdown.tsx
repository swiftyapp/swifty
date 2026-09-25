import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/utils/cx'

/**
 * The app's one menu, per the Rowel menus prototype: a 12px-radius sheet with
 * 5px of padding, 32px rows with 9px side padding and a 7px radius, 13px
 * primary ink, a 10px gap between a row's parts. The sheet is `--menu` over a
 * saturated blur, edged by `--menu-line`, and drops in over 140ms. Every menu
 * in the app (sort, scope, tags, the entry's overflow, the vault picker) is
 * this one, so a measurement changes here and nowhere else.
 */

interface DropdownProps {
  onBlur: () => void
  /**
   * The items' id, given when a search field in the header drives them. The
   * body is then a `listbox` the field controls (a combobox's popup has to
   * be one) and the items are its options, rather than a `menu` of items the
   * arrows focus in turn.
   */
  listbox?: string
  // Placement against the nearest positioned ancestor (e.g. 'right-0 top-8').
  className?: string
  /**
   * Full-bleed above the items, outside their padding: a search field. A menu
   * that has one opens on it rather than on an item.
   */
  header?: ReactNode
  // The items' own scrolling body — a max height, for a list that can run long.
  listClassName?: string
  children: ReactNode
}

export function Dropdown({
  onBlur,
  listbox,
  className,
  header,
  listClassName,
  children
}: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)

  // Every kind of item: plain, the radio kind a single-select menu uses, and
  // the options of a listbox a search field drives.
  const items = () =>
    Array.from(
      ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"], [role="option"]') ?? []
    )

  // Roving focus: unlike a radio group the arrows only *move*, they never
  // activate, so the menu holds no selection of its own.
  const move = (step: number) => {
    const all = items()
    if (all.length === 0) return
    const from = all.indexOf(document.activeElement as HTMLElement)
    all[(from + step + all.length) % all.length].focus()
  }

  // The menu takes focus on open so the keyboard lands inside it — on its
  // search field if it has one, else on the item already chosen, else the
  // first — and hands focus back to whatever opened it on Escape.
  useEffect(() => {
    trigger.current = document.activeElement as HTMLElement | null
    const all = items()
    const start =
      ref.current?.querySelector('input') ??
      all.find(item => item.getAttribute('aria-checked') === 'true') ??
      all[0]
    start?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        move(1)
        break
      case 'ArrowUp':
        move(-1)
        break
      case 'Escape':
        // An open menu owns Escape. Modal and Generator listen on `window`
        // and Sheet on `document` — all ancestors of the React root — so
        // without this the one press would dismiss the overlay underneath too.
        event.stopPropagation()
        onBlur()
        trigger.current?.focus()
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <>
      <div
        ref={ref}
        role={listbox ? undefined : 'menu'}
        onKeyDown={onKeyDown}
        className={cx(
          'animate-drop absolute z-20 flex min-w-[180px] origin-top flex-col overflow-hidden rounded-[12px] border border-menu-line bg-menu text-text shadow-menu backdrop-blur-[24px] backdrop-saturate-[1.6]',
          className
        )}
      >
        {header}
        <div
          id={listbox}
          role={listbox && 'listbox'}
          className={cx('flex flex-col overflow-y-auto p-[5px]', listClassName)}
        >
          {children}
        </div>
      </div>
      <div
        data-testid="dropdown-scrim"
        className="fixed inset-0 z-10"
        onClick={onBlur}
      />
    </>
  )
}

interface ItemProps {
  // Stable, for a field that names the lit item by `aria-activedescendant`.
  id?: string
  /**
   * An option of the listbox a search field drives (see `Dropdown.listbox`):
   * `aria-selected` says which one the field has lit — `active` — and a
   * `checked` item says it is the chosen one by `aria-checked`.
   */
  option?: boolean
  // A rule across the menu above this item, setting it apart.
  separated?: boolean
  // Destructive entry (delete, disconnect, ...): inked in the `bad` token.
  danger?: boolean
  /**
   * Quiet: a place with nothing in it yet. Still a row — it can be picked,
   * and lands on the empty state — but at under half its ink.
   */
  dim?: boolean
  testid?: string
  onClick?: () => void
  // Spacing overrides for a row that is not a plain label (a tile with two
  // lines of text is taller than the 32px default).
  className?: string
  /**
   * Set on every item of a menu that picks one of several (a sort order, a
   * vault): the item becomes a `menuitemradio` and says whether it is the one,
   * so the selection a check glyph shows is also told to assistive technology.
   * The chosen one sits on the selection wash. Left undefined, the item is a
   * plain action.
   */
  checked?: boolean
  /**
   * Given, the caller owns the highlight and the pointer and focus stop
   * drawing it: a menu whose keyboard stays in a search field moves it by
   * index, and one highlight has to follow both hands (see WorkspacePicker).
   */
  active?: boolean
  onMouseEnter?: () => void
  onFocus?: () => void
  children: ReactNode
}

export function DropdownItem({
  id,
  option,
  separated,
  danger,
  dim,
  testid,
  onClick,
  className,
  checked,
  active,
  onMouseEnter,
  onFocus,
  children
}: ItemProps) {
  const radio = checked !== undefined
  // The chosen row keeps the selection wash; every other row takes the hover
  // wash under the pointer or the keyboard. Keyboard focus borrows the hover
  // treatment instead of the global outline, which would ring a rounded row
  // inset in a rounded panel.
  const highlight =
    active !== undefined
      ? active && (checked ? 'bg-sel' : 'bg-hover')
      : checked
        ? 'bg-sel'
        : 'hover:bg-hover focus-visible:bg-hover'

  return (
    <>
      {separated && <DropdownSeparator />}
      <button
        type="button"
        id={id}
        role={option ? 'option' : radio ? 'menuitemradio' : 'menuitem'}
        aria-selected={option ? !!active : undefined}
        aria-checked={checked}
        data-testid={testid}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        className={cx(
          'flex min-h-8 w-full flex-none cursor-pointer items-center gap-2.5 rounded-[7px] px-[9px] text-left text-base focus-visible:outline-none',
          danger ? 'text-bad' : 'text-text',
          dim && 'opacity-45',
          highlight,
          className
        )}
      >
        {children}
      </button>
    </>
  )
}

/** A rule between two runs of items, inset to the rows' text edge. */
export function DropdownSeparator() {
  return <div role="separator" className="mx-[9px] my-[5px] h-px flex-none bg-line" />
}

/** The caption over a run of items ("Kinds", "Sort by"): 11px, the third ink. */
export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <div role="presentation" className="px-[9px] pb-1 pt-[5px] text-xs font-medium text-text3">
      {children}
    </div>
  )
}

/**
 * A row's trailing figure — a count, or a chord — in the mono face at half
 * ink, so it reads after the label. Tabular, so a count holds its width.
 */
export function DropdownMeta({
  children,
  testid,
  hint
}: {
  children: ReactNode
  testid?: string
  /** A keyboard hint rather than a count: a touch smaller and quieter. */
  hint?: boolean
}) {
  return (
    <span
      data-testid={testid}
      className={cx(
        'flex-none font-mono tabular-nums',
        hint ? 'text-xs opacity-45' : 'text-[11.5px] opacity-50'
      )}
    >
      {children}
    </span>
  )
}
