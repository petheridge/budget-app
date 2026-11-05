import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BudgetMenu } from '../components/BudgetMenu'
import { EntryMenu } from '../components/EntryMenu'
import { InlineAmount } from '../components/InlineAmount'
import { InlineName } from '../components/InlineName'
import { InlineNote } from '../components/InlineNote'
import { DraftEntryRow } from '../components/DraftEntryRow'
import { EditableTitle, Header, HeaderButton } from '../components/Header'
import { DotsIcon, MenuIcon } from '../components/icons'
import { ReorderList } from '../components/ReorderList'
import { AddLinks, EntrySection, Hero, HeroPart, TitleWithAmount, useHero } from '../components/Sections'
import { useOverlay } from '../components/useOverlay'
import { useData } from '../lib/data'
import {
  balance,
  balanceColour,
  expenseTotal,
  formatSigned,
  incomeTotal,
  signedValue,
  typeColour,
  type EntryType,
} from '../lib/money'
import { isTracker, type Entry } from '../lib/pb'
import { TrackerDetail } from './TrackerDetail'
import { entriesIn, linkTarget } from '../lib/selectors'

// Menus open from the button tapped (`anchor`).
type Sheet =
  | { kind: 'budgetMenu'; anchor: HTMLElement }
  | { kind: 'entryMenu'; id: string; anchor: HTMLElement }

export function BudgetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { budgets, folders, entries, reorderEntries, renameBudget, report } = useData()
  const { sheet, open: setSheet, close } = useOverlay<Sheet>()
  const [renaming, setRenaming] = useState(false)
  // The entry whose note is open for editing, if any.
  const [editingNote, setEditingNote] = useState<string | null>(null)
  // The new entry being typed inline. The key lets a row that finishes saving
  // after another was started close itself without closing the new one.
  const [draft, setDraft] = useState<{ key: number; type: EntryType } | null>(null)
  const startDraft = (type: EntryType) => setDraft({ key: Date.now(), type })
  const endDraft = (key: number) => setDraft((d) => (d?.key === key ? null : d))
  // The entry whose amount is open on the keypad, if any.
  const [editingAmount, setEditingAmount] = useState<string | null>(null)
  const closeAmount = useCallback(() => setEditingAmount(null), [])
  const hero = useHero()

  const budget = budgets.find((b) => b.id === id)
  if (!budget) return <Navigate to="/" replace />
  if (isTracker(budget)) return <TrackerDetail budget={budget} />

  const folder = folders.find((f) => f.id === budget.folder)
  const backTo = folder ? `/folder/${folder.id}` : '/'
  const rows = entriesIn(entries, budget.id)
  const total = balance(rows)
  // Income and expenses each have their own section, reordered within it.
  const ofType = (type: EntryType) => rows.filter((e) => e.type === type)
  // A section shows once it has something in it (or one is being added), so a budget
  // used for just one kind isn't cluttered with an empty section.
  const shown = (['income', 'expense'] as const).filter((type) => ofType(type).length > 0 || draft?.type === type)
  const hidden = (['income', 'expense'] as const).filter((type) => !shown.includes(type))
  const reorderWithin = (type: EntryType, ordered: Entry[]) =>
    reorderEntries(type === 'income' ? [...ordered, ...ofType('expense')] : [...ofType('income'), ...ordered])
  const openEntry = sheet?.kind === 'entryMenu' ? rows.find((e) => e.id === sheet.id) : undefined

  const renderRow = (entry: Entry) => {
    const colour = typeColour(entry.type)
    return (
      <div className="flex min-h-[54px] items-stretch border-b border-line bg-surface">
        <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 pl-4">
          <div className="min-w-0 flex-1">
            <InlineName entry={entry} className={`font-semibold ${colour}`} />
            <InlineNote
              entry={entry}
              editing={editingNote === entry.id}
              onDone={() => setEditingNote(null)}
            />
            <LinkedTo entry={entry} />
          </div>
          <InlineAmount
            entry={entry}
            open={editingAmount === entry.id}
            onOpen={() => setEditingAmount(entry.id)}
            onClose={closeAmount}
            className={`font-semibold whitespace-nowrap ${colour}`}
          >
            {formatSigned(signedValue(entry))}
          </InlineAmount>
        </div>
        <button
          type="button"
          aria-label={`Options for ${entry.name}`}
          aria-haspopup="menu"
          onClick={(event) => setSheet({ kind: 'entryMenu', id: entry.id, anchor: event.currentTarget })}
          className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-line text-brand"
        >
          <DotsIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title={
          <TitleWithAmount
            amount={hero.scrolledPast && !renaming ? formatSigned(total) : null}
            title={
              <EditableTitle
                name={budget.name}
                renaming={renaming}
                onDone={(name) => {
                  setRenaming(false)
                  if (name) report('rename the budget', renameBudget(budget.id, name))
                }}
              />
            }
          />
        }
        back={{ to: backTo, label: folder?.name ?? 'Budgets', isFolder: !!folder }}
        actions={
          <HeaderButton label="Budget menu" opensMenu onClick={(anchor) => setSheet({ kind: 'budgetMenu', anchor })}>
            <MenuIcon />
          </HeaderButton>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <Hero
          label="Balance"
          amount={formatSigned(total)}
          colour={balanceColour(total)}
          amountRef={hero.amountRef}
          detail={
            shown.length === 2 && (
              <>
                <HeroPart type="income" total={incomeTotal(rows)} /> · <HeroPart type="expense" total={expenseTotal(rows)} />
              </>
            )
          }
        />
        {shown.map((type) => (
          <EntrySection
            key={type}
            type={type}
            total={type === 'income' ? incomeTotal(rows) : expenseTotal(rows)}
            onAdd={() => startDraft(type)}
          >
            <ReorderList items={ofType(type)} getId={(entry) => entry.id} onReorder={(ordered) => reorderWithin(type, ordered)}>
              {renderRow}
            </ReorderList>
            {draft?.type === type && (
              <DraftEntryRow
                key={draft.key}
                budgetId={budget.id}
                type={draft.type}
                onDone={() => endDraft(draft.key)}
              />
            )}
          </EntrySection>
        ))}
        <AddLinks types={hidden} onAdd={startDraft} />
      </main>

      {sheet?.kind === 'budgetMenu' && (
        <BudgetMenu
          key={sheet.instance}
          budget={budget}
          anchor={sheet.anchor}
          onClose={close}
          onRename={() => setRenaming(true)}
          onBeforeDelete={() => navigate(backTo, { replace: true })}
        />
      )}
      {sheet?.kind === 'entryMenu' && openEntry && <EntryMenu key={sheet.instance} entry={openEntry} anchor={sheet.anchor} onClose={close} onEditNote={() => setEditingNote(openEntry.id)} />}
    </div>
  )
}

/** "→ Cash ISA" under an expense linked to a saving or debt. */
function LinkedTo({ entry }: { entry: Entry }) {
  const { entries, budgets } = useData()
  const target = linkTarget(entry, entries, budgets)
  if (!target) return null
  return <p className="mt-0.5 text-xs break-words text-brand">→ {target.name}</p>
}
