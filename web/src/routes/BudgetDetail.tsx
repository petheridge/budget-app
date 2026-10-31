import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BudgetMenu } from '../components/BudgetMenu'
import { EntryMenu } from '../components/EntryMenu'
import { EntrySheet } from '../components/EntrySheet'
import { Header, HeaderButton } from '../components/Header'
import { DotsIcon, MenuIcon, PencilIcon } from '../components/icons'
import { ReorderList } from '../components/ReorderList'
import { useData } from '../lib/data'
import {
  balance,
  balanceColour,
  expenseTotal,
  formatSigned,
  incomeTotal,
  signedValue,
  type EntryType,
} from '../lib/money'
import { entriesIn } from '../lib/selectors'

type Sheet =
  | { kind: 'add'; type: EntryType }
  | { kind: 'budgetMenu' }
  | { kind: 'entryMenu'; id: string }

export function BudgetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { budgets, folders, entries, reorderEntries } = useData()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = () => setSheet(null)

  const budget = budgets.find((b) => b.id === id)
  if (!budget) return <Navigate to="/" replace />

  const folder = folders.find((f) => f.id === budget.folder)
  const backTo = folder ? `/folder/${folder.id}` : '/'
  const rows = entriesIn(entries, budget.id)
  const total = balance(rows)
  const openEntry = sheet?.kind === 'entryMenu' ? rows.find((e) => e.id === sheet.id) : undefined

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
          {(entry, handle) => {
            const colour = entry.type === 'income' ? 'text-income' : 'text-expense'
            return (
              <div className="flex min-h-[68px] items-stretch border-b border-black/10 bg-surface">
                {handle}
                <div className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2">
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold break-words ${colour}`}>{entry.name}</p>
                    {entry.note && (
                      <p className="mt-0.5 flex items-start gap-1 text-xs break-words text-muted">
                        <PencilIcon />
                        <span className="min-w-0">{entry.note}</span>
                      </p>
                    )}
                  </div>
                  <span className={`font-semibold whitespace-nowrap ${colour}`}>
                    {formatSigned(signedValue(entry))}
                  </span>
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
      </main>

      <footer className="shrink-0 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_4px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-2 gap-2.5 p-3 pb-2">
          <button
            type="button"
            onClick={() => setSheet({ kind: 'add', type: 'income' })}
            className="rounded-xl bg-income py-3.5 font-bold text-white"
          >
            Add Income
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: 'add', type: 'expense' })}
            className="rounded-xl bg-expense py-3.5 font-bold text-white"
          >
            Add Expense
          </button>
        </div>
        <div className="flex items-stretch gap-3 px-4 pb-3">
          <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] content-center gap-x-2 text-sm">
            <dt className="text-muted">Income:</dt>
            <dd className="font-semibold whitespace-nowrap text-income">
              {formatSigned(incomeTotal(rows))}
            </dd>
            <dt className="text-muted">Expenses:</dt>
            <dd className="font-semibold whitespace-nowrap text-expense">
              {formatSigned(-expenseTotal(rows))}
            </dd>
          </dl>
          <div className="border-l border-black/10 pl-3 text-right">
            <p className="text-sm text-muted">Balance</p>
            <p className={`text-2xl font-bold whitespace-nowrap ${balanceColour(total)}`}>
              {formatSigned(total)}
            </p>
          </div>
        </div>
      </footer>

      {sheet?.kind === 'add' && <EntrySheet budgetId={budget.id} type={sheet.type} onClose={close} />}
      {sheet?.kind === 'budgetMenu' && (
        <BudgetMenu budget={budget} onClose={close} onBeforeDelete={() => navigate(backTo, { replace: true })} />
      )}
      {openEntry && <EntryMenu entry={openEntry} onClose={close} />}
    </div>
  )
}
