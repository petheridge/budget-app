import type { ReactNode } from 'react'
import { typeColour } from '../lib/money'
import type { Entry } from '../lib/pb'
import { DotsIcon } from './icons'
import { InlineAmount } from './InlineAmount'
import { InlineName } from './InlineName'
import { InlineNote } from './InlineNote'

/**
 * One entry in a list, the same in budgets and in savings & debts: its name and
 * note (both edited in place), anything else to say under the name, its amount
 * (which opens the keypad), and its ⋮ menu button.
 */
export function EntryRow({
  entry,
  under,
  amount,
  amountClassName,
  editingNote,
  onNoteDone,
  amountOpen,
  onAmountOpen,
  onAmountClose,
  onMenu,
}: {
  entry: Entry
  /** Lines under the name and note, such as what the entry is linked to. */
  under?: ReactNode
  /** The amount as the list shows it while the keypad is closed. */
  amount: ReactNode
  amountClassName: string
  editingNote: boolean
  onNoteDone: () => void
  amountOpen: boolean
  onAmountOpen: () => void
  onAmountClose: () => void
  /** Given the ⋮ button, for the menu to open from. */
  onMenu: (anchor: HTMLElement) => void
}) {
  return (
    <div className="flex min-h-[54px] items-stretch border-b border-line bg-surface">
      <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <InlineName entry={entry} className={`font-semibold ${typeColour(entry.type)}`} />
          <InlineNote entry={entry} editing={editingNote} onDone={onNoteDone} />
          {under}
        </div>
        <InlineAmount
          entry={entry}
          open={amountOpen}
          onOpen={onAmountOpen}
          onClose={onAmountClose}
          className={amountClassName}
        >
          {amount}
        </InlineAmount>
      </div>
      <button
        type="button"
        aria-label={`Options for ${entry.name}`}
        aria-haspopup="menu"
        onClick={(event) => onMenu(event.currentTarget)}
        className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-line text-brand"
      >
        <DotsIcon />
      </button>
    </div>
  )
}
