import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { useData } from '../lib/data'
import { formatUnsigned, typeColour } from '../lib/money'
import { isTracker } from '../lib/pb'
import { entriesIn, linkTarget } from '../lib/selectors'

/**
 * Chooses the saving or debt a budget expense pays into, shown as a label on both
 * ("→ Cash ISA" and "£ 250.00 a month from Household"). Lists every savings & debts
 * budget's items. Choosing one goes back to the budget.
 */
export function LinkPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { budgets, entries, setEntryLink } = useData()
  const [failed, setFailed] = useState(false)

  const entry = entries.find((e) => e.id === id)
  const budget = budgets.find((b) => b.id === entry?.budget)
  if (!entry || !budget) return <Navigate to="/" replace />

  const backTo = `/budget/${budget.id}`
  const current = linkTarget(entry, entries, budgets)
  const groups = budgets
    .filter(isTracker)
    .map((tracker) => ({ tracker, items: entriesIn(entries, tracker.id) }))
    .filter((group) => group.items.length > 0)

  async function choose(link: string) {
    try {
      if (link !== (current?.id ?? '')) await setEntryLink(entry!.id, link)
      // Replaces this screen, so Back from the budget doesn't come here again.
      navigate(backTo, { replace: true })
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title={<span className="truncate">Link</span>}
        back={{ to: backTo, label: budget.name, isFolder: false }}
      />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-3 p-4">
          <div className="text-center">
            <h2 className="truncate text-lg font-semibold">“{entry.name}”</h2>
            <p className="text-sm text-muted">Which saving or debt does this pay into?</p>
          </div>
          {groups.length === 0 ? (
            <p className="rounded-xl bg-surface p-4 text-center text-muted">
              There are no savings or debts yet. Add a Savings &amp; debts budget first.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map(({ tracker, items }) => (
                <section key={tracker.id} aria-label={tracker.name}>
                  <h3 className="px-1 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                    {tracker.name}
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
        </div>
      </main>
    </div>
  )
}
