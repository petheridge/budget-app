import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { formatDay } from '../components/Change'
import { Header } from '../components/Header'
import { useData } from '../lib/data'
import { formatUnsigned, parsePence, penceToInput, typeColour } from '../lib/money'
import { isTracker } from '../lib/pb'
import { entriesIn, historyOf } from '../lib/selectors'

/**
 * Monthly catch-up for a savings & debts budget: every item on one page with its
 * current value filled in. Type over the ones that changed; Save records today's
 * value for all of them, unchanged ones too, so each catch-up is complete.
 */
export function CatchUp() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { budgets, entries, snapshots, catchUp } = useData()
  const budget = budgets.find((b) => b.id === id)
  const rows = budget ? entriesIn(entries, budget.id) : []
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((e) => [e.id, penceToInput(e.amount_pence)])),
  )
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
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
      const text = (values[entry.id] ?? '').trim()
      // Blank keeps the current value.
      const pence = text === '' ? entry.amount_pence : parsePence(text)
      if (pence === null) bad.add(entry.id)
      else parsed.set(entry.id, pence)
    }
    setInvalid(bad)
    if (bad.size > 0) return
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

  // Return moves to the next value, and from the last one saves.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const next = document.getElementById(`catch-up-${index + 1}`)
    if (next) next.focus()
    else event.currentTarget.form?.requestSubmit()
  }

  return (
    <form onSubmit={save} noValidate className="flex h-full flex-col">
      <Header title="Catch Up" back={{ to: backTo, label: budget.name, isFolder: false }} />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p className="px-4 py-3 text-sm text-muted">
          Update any values that have changed. Saving records today's value for every item.
        </p>
        <ul>
          {rows.map((entry, index) => {
            const last = historyOf(snapshots, entry.id)[0]
            const colour = typeColour(entry.type)
            return (
              <li key={entry.id} className="border-b border-black/10 bg-surface first:border-t">
                <label className="flex min-h-[68px] items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold break-words ${colour}`}>{entry.name}</span>
                    {last && (
                      <span className="block text-xs text-muted">
                        {formatUnsigned(last.amount_pence)} on {formatDay(last.created)}
                      </span>
                    )}
                  </span>
                  <span className={`flex items-center gap-1 font-semibold ${colour}`}>
                    £
                    <input
                      id={`catch-up-${index}`}
                      inputMode="decimal"
                      enterKeyHint={index === rows.length - 1 ? 'done' : 'next'}
                      value={values[entry.id] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [entry.id]: e.target.value }))}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => onKeyDown(e, index)}
                      aria-invalid={invalid.has(entry.id)}
                      // 16px text stops iOS zooming in on focus.
                      className={`w-32 rounded-lg border bg-bg px-2 py-2 text-right text-base outline-none focus:border-brand ${invalid.has(entry.id) ? 'border-expense' : 'border-transparent'}`}
                    />
                  </span>
                </label>
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
