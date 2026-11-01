import { useState } from 'react'
import { useData } from '../lib/data'
import { formatUnsigned, typeColour } from '../lib/money'
import { isTracker, type Entry } from '../lib/pb'
import { entriesIn, linkTarget } from '../lib/selectors'
import { SheetFrame } from './Sheet'

/**
 * Chooses the saving or debt a budget expense pays into, so Catch Up can suggest
 * the value it should have reached. Lists every savings & debts budget's items.
 */
export function LinkSheet({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { budgets, entries, setEntryLink } = useData()
  const [failed, setFailed] = useState(false)
  const current = linkTarget(entry, entries, budgets)
  const groups = budgets
    .filter(isTracker)
    .map((budget) => ({ budget, items: entriesIn(entries, budget.id) }))
    .filter((group) => group.items.length > 0)

  async function choose(link: string) {
    try {
      if (link !== (current?.id ?? '')) await setEntryLink(entry.id, link)
      onClose()
    } catch {
      setFailed(true)
    }
  }

  return (
    <SheetFrame label={`Link ${entry.name}`} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <div className="text-center">
          <h2 className="truncate text-lg font-semibold">Link “{entry.name}”</h2>
          <p className="text-sm text-muted">
            Which saving or debt does this pay into? Catch Up will suggest its new value.
          </p>
        </div>
        {groups.length === 0 ? (
          <p className="rounded-xl bg-surface p-4 text-center text-muted">
            There are no savings or debts yet. Add a Savings &amp; debts budget first.
          </p>
        ) : (
          <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto overscroll-contain">
            {groups.map(({ budget, items }) => (
              <section key={budget.id} aria-label={budget.name}>
                <h3 className="px-1 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                  {budget.name}
                </h3>
                <ul className="overflow-hidden rounded-xl bg-surface">
                  {items.map((item) => {
                    const selected = item.id === current?.id
                    return (
                      <li key={item.id} className="border-b border-line last:border-b-0">
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => void choose(item.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          <span className={`min-w-0 flex-1 truncate font-semibold ${typeColour(item.type)}`}>
                            {item.name}
                          </span>
                          <span className="text-sm whitespace-nowrap text-muted">
                            {formatUnsigned(item.amount_pence)}
                          </span>
                          <span aria-hidden className="w-5 text-right text-lg font-bold text-brand">
                            {selected ? '✓' : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
        {failed && <p className="text-center text-sm text-expense">Couldn't save the link. Please try again.</p>}
        {current && (
          <button
            type="button"
            onClick={() => void choose('')}
            className="rounded-xl bg-surface py-3.5 text-base font-semibold text-expense"
          >
            Remove Link
          </button>
        )}
        <button type="button" onClick={onClose} className="py-3 text-base text-muted">
          Cancel
        </button>
      </div>
    </SheetFrame>
  )
}
