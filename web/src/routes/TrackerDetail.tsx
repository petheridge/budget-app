import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BudgetMenu } from '../components/BudgetMenu'
import { ChangeText, formatDay } from '../components/Change'
import { DraftEntryRow } from '../components/DraftEntryRow'
import { EntryMenu } from '../components/EntryMenu'
import { Header, HeaderButton } from '../components/Header'
import { HistorySheet } from '../components/HistorySheet'
import { InlineAmount } from '../components/InlineAmount'
import { DotsIcon, MenuIcon, PencilIcon } from '../components/icons'
import { ReorderList } from '../components/ReorderList'
import { useData } from '../lib/data'
import {
  balance,
  balanceColour,
  formatSigned,
  formatUnsigned,
  isGoodChange,
  typeColour,
  typeTotal,
  type EntryType,
} from '../lib/money'
import type { Budget, Entry } from '../lib/pb'
import { changeSincePrevious, entriesIn, linkedInto } from '../lib/selectors'

type Sheet = { kind: 'budgetMenu' } | { kind: 'entryMenu'; id: string } | { kind: 'history'; id: string }

/**
 * A savings & debts budget: each item has a current value, recorded with a date
 * whenever it changes, so the screen shows where things stand and how they've moved.
 */
export function TrackerDetail({ budget }: { budget: Budget }) {
  const navigate = useNavigate()
  const { folders, budgets, entries, snapshots, reorderEntries } = useData()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = () => setSheet(null)
  // As in BudgetDetail: the key lets a row that finishes saving late close only itself.
  const [draft, setDraft] = useState<{ key: number; type: EntryType } | null>(null)
  const startDraft = (type: EntryType) => setDraft({ key: Date.now(), type })
  const endDraft = (key: number) => setDraft((d) => (d?.key === key ? null : d))
  // The item whose value is open on the keypad, if any.
  const [editingAmount, setEditingAmount] = useState<string | null>(null)
  const closeAmount = useCallback(() => setEditingAmount(null), [])

  const folder = folders.find((f) => f.id === budget.folder)
  const backTo = folder ? `/folder/${folder.id}` : '/'
  const rows = entriesIn(entries, budget.id)
  const netWorth = balance(rows)
  const openEntry = sheet && sheet.kind !== 'budgetMenu' ? rows.find((e) => e.id === sheet.id) : undefined

  return (
    <div className="flex h-full flex-col">
      <Header
        title={<span className="truncate">{budget.name}</span>}
        back={{ to: backTo, label: folder?.name ?? 'Budgets', isFolder: !!folder }}
        actions={
          <HeaderButton label="Budget menu" onClick={() => setSheet({ kind: 'budgetMenu' })}>
            <MenuIcon />
          </HeaderButton>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ReorderList items={rows} getId={(entry) => entry.id} onReorder={reorderEntries}>
          {(entry) => {
            const colour = typeColour(entry.type)
            const moved = changeSincePrevious(entry, snapshots)
            return (
              <div className="flex min-h-[54px] items-stretch border-b border-black/10 bg-surface">
                <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 pl-4">
                  <button
                    type="button"
                    aria-label={`${entry.name} history`}
                    onClick={() => setSheet({ kind: 'history', id: entry.id })}
                    className="min-w-0 flex-1 self-stretch text-left"
                  >
                    <span className={`block font-semibold break-words ${colour}`}>{entry.name}</span>
                    {entry.note && (
                      <span className="mt-0.5 flex items-start gap-1 text-xs break-words text-muted">
                        <PencilIcon />
                        <span className="min-w-0">{entry.note}</span>
                      </span>
                    )}
                    <LinkedFrom links={linkedInto(entry, entries, budgets)} budgets={budgets} />
                  </button>
                  <InlineAmount
                    entry={entry}
                    open={editingAmount === entry.id}
                    onOpen={() => setEditingAmount(entry.id)}
                    onClose={closeAmount}
                    className="font-semibold"
                  >
                    <span className={`block whitespace-nowrap ${colour}`}>{formatUnsigned(entry.amount_pence)}</span>
                    {moved && (
                      <span className="block whitespace-nowrap">
                        <ChangeText
                          change={moved.change}
                          good={isGoodChange(entry.type, moved.change)}
                          suffix={` since ${formatDay(moved.since)}`}
                        />
                      </span>
                    )}
                  </InlineAmount>
                </div>
                <button
                  type="button"
                  aria-label={`Options for ${entry.name}`}
                  onClick={() => setSheet({ kind: 'entryMenu', id: entry.id })}
                  className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-black/10 text-brand"
                >
                  <DotsIcon />
                </button>
              </div>
            )
          }}
        </ReorderList>
        {draft && (
          <DraftEntryRow
            key={draft.key}
            budgetId={budget.id}
            type={draft.type}
            onDone={() => endDraft(draft.key)}
          />
        )}
        {rows.length === 0 && !draft && (
          <p className="p-8 text-center text-muted">
            Add your savings and debts, like an ISA or a mortgage, with their current values. Use Catch
            Up each month to record new values.
          </p>
        )}
      </main>

      <footer className="shrink-0 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_4px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-3 gap-2 p-3 pb-2">
          <button
            type="button"
            onClick={() => startDraft('saving')}
            className="rounded-xl bg-income py-3.5 font-bold text-white"
          >
            Add Saving
          </button>
          <button
            type="button"
            onClick={() => startDraft('debt')}
            className="rounded-xl bg-expense py-3.5 font-bold text-white"
          >
            Add Debt
          </button>
          {rows.length > 0 ? (
            <Link
              to={`/budget/${budget.id}/catch-up`}
              className="rounded-xl bg-brand py-3.5 text-center font-bold text-white"
            >
              Catch Up
            </Link>
          ) : (
            <span className="rounded-xl bg-brand/40 py-3.5 text-center font-bold text-white">Catch Up</span>
          )}
        </div>
        <div className="flex items-stretch gap-3 px-4 pb-3">
          <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] content-center gap-x-2 text-sm">
            <dt className="text-muted">Savings:</dt>
            <dd className="font-semibold whitespace-nowrap text-income">
              {formatSigned(typeTotal(rows, 'saving'))}
            </dd>
            <dt className="text-muted">Debts:</dt>
            <dd className="font-semibold whitespace-nowrap text-expense">
              {formatSigned(-typeTotal(rows, 'debt'))}
            </dd>
          </dl>
          <div className="border-l border-black/10 pl-3 text-right">
            <p className="text-sm text-muted">Net worth</p>
            <p className={`text-2xl font-bold whitespace-nowrap ${balanceColour(netWorth)}`}>
              {formatSigned(netWorth)}
            </p>
          </div>
        </div>
      </footer>

      {sheet?.kind === 'budgetMenu' && (
        <BudgetMenu budget={budget} onClose={close} onBeforeDelete={() => navigate(backTo, { replace: true })} />
      )}
      {sheet?.kind === 'entryMenu' && openEntry && <EntryMenu entry={openEntry} onClose={close} />}
      {sheet?.kind === 'history' && openEntry && <HistorySheet entry={openEntry} onClose={close} />}
    </div>
  )
}

/** "£ 250.00 a month from Household" under a saving or debt with linked payments. */
function LinkedFrom({ links, budgets }: { links: Entry[]; budgets: Budget[] }) {
  if (links.length === 0) return null
  const monthly = links.reduce((total, e) => total + e.amount_pence, 0)
  const from = [...new Set(links.map((e) => budgets.find((b) => b.id === e.budget)?.name))].join(', ')
  return (
    <span className="mt-0.5 block text-xs break-words text-brand">
      {formatUnsigned(monthly)} a month from {from}
    </span>
  )
}
