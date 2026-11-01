import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AmountField } from '../components/AmountPad'
import { formatDay } from '../components/Change'
import { Header } from '../components/Header'
import { useData } from '../lib/data'
import { evaluateAmount, formatUnsigned, penceToInput, typeColour } from '../lib/money'
import { isTracker } from '../lib/pb'
import { entriesIn, expectedValue, historyOf } from '../lib/selectors'

/**
 * Monthly catch-up for a savings & debts budget: every item on one page with its
 * current value filled in. Type over the ones that changed; Save records today's
 * value for all of them, unchanged ones too, so each catch-up is complete.
 */
export function CatchUp() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { budgets, entries, snapshots, catchUp } = useData()
  // Fixed when the page opens, so the suggestions don't shift while typing.
  const [now] = useState(() => new Date())
  const budget = budgets.find((b) => b.id === id)
  const rows = budget ? entriesIn(entries, budget.id) : []
  const [values, setValues] = useState<Record<string, string>>(() =>
    // Linked items start at their expected value; the rest at their current one.
    Object.fromEntries(
      rows.map((e) => [e.id, penceToInput(expectedValue(e, entries, budgets, snapshots, now)?.pence ?? e.amount_pence)]),
    ),
  )
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  // Which item's keypad is open, by position in the list.
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!budget || !isTracker(budget)) return <Navigate to={id ? `/budget/${id}` : '/'} replace />
  const backTo = `/budget/${budget.id}`

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const parsed = new Map<string, number>()
    const bad = new Set<string>()
    for (const entry of rows) {
      const result = evaluateAmount(values[entry.id] ?? '')
      // Blank keeps the current value.
      if (result === null) parsed.set(entry.id, entry.amount_pence)
      else if (result.ok) parsed.set(entry.id, result.pence)
      else bad.add(entry.id)
    }
    setInvalid(bad)
    if (bad.size > 0) return
    setOpenIndex(null)
    setBusy(true)
    setFailed(false)
    try {
      await catchUp(parsed)
      navigate(backTo, { replace: true })
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex h-full flex-col">
      <Header title="Catch Up" back={{ to: backTo, label: budget.name, isFolder: false }} />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p className="px-4 py-3 text-sm text-muted">
          Update any values that have changed. Tap a value to change it: start with + or − to add to it
          or take away from it. Items with linked payments start at their expected value. Saving records
          today's value for every item.
        </p>
        <ul>
          {rows.map((entry, index) => {
            const last = historyOf(snapshots, entry.id)[0]
            const expected = expectedValue(entry, entries, budgets, snapshots, now)
            const colour = typeColour(entry.type)
            return (
              <li key={entry.id} className="border-b border-black/10 bg-surface first:border-t">
                <div className="flex min-h-[68px] items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold break-words ${colour}`}>{entry.name}</span>
                    {last && (
                      <span className="block text-xs text-muted">
                        {formatUnsigned(last.amount_pence)} on {formatDay(last.created)}
                      </span>
                    )}
                    {expected && (
                      <span className="block text-xs text-brand">
                        Expected: {entry.type === 'debt' ? '−' : '+'} {formatUnsigned(expected.monthly)} a month
                        {expected.months > 1 ? ` × ${expected.months} months` : ''}
                      </span>
                    )}
                  </span>
                  <span className={`flex items-center gap-1 font-semibold ${colour}`}>
                    £
                    <AmountField
                      label={`${entry.name} value`}
                      placeholder="0.00"
                      value={values[entry.id] ?? ''}
                      onChange={(text) => {
                        setValues((v) => ({ ...v, [entry.id]: text }))
                        setInvalid((bad) => {
                          const next = new Set(bad)
                          next.delete(entry.id)
                          return next
                        })
                      }}
                      open={openIndex === index}
                      onOpen={() => setOpenIndex(index)}
                      // Done moves to the next item; on the last it closes the keypad.
                      onDone={() => setOpenIndex(index + 1 < rows.length ? index + 1 : null)}
                      doneLabel={index + 1 < rows.length ? 'Next' : 'Done'}
                      className={`w-36 rounded-lg border bg-bg px-2 py-2 text-right text-base ${invalid.has(entry.id) ? 'border-expense' : 'border-transparent'}`}
                    />
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        {invalid.size > 0 && (
          <p className="px-4 py-3 text-sm text-expense">Check the highlighted amounts, like 1250.00.</p>
        )}
      </main>

      <footer className="shrink-0 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_4px_rgba(0,0,0,0.08)]">
        <div className="p-3">
          {failed && <p className="pb-2 text-center text-sm text-expense">Couldn't save. Please try again.</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3.5 font-bold text-white disabled:opacity-60"
          >
            Save Catch-Up
          </button>
        </div>
      </footer>
    </form>
  )
}
