import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BudgetMenu } from '../components/BudgetMenu'
import { ChangeText, formatDay } from '../components/Change'
import { DraftEntryRow } from '../components/DraftEntryRow'
import { EntryMenu } from '../components/EntryMenu'
import { EditableTitle, Header, HeaderButton } from '../components/Header'
import { InlineAmount } from '../components/InlineAmount'
import { InlineName } from '../components/InlineName'
import { InlineNote } from '../components/InlineNote'
import { DotsIcon, MenuIcon } from '../components/icons'
import { ReorderList } from '../components/ReorderList'
import { AddLinks, EntrySection, Hero, HeroPart, TitleWithAmount, useHero } from '../components/Sections'
import { useOverlay } from '../components/useOverlay'
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

// Menus open from the button tapped (`anchor`).
type Sheet = { kind: 'budgetMenu'; anchor: HTMLElement } | { kind: 'entryMenu'; id: string; anchor: HTMLElement }

/**
 * A savings & debts budget: each item has a current value, recorded with a date
 * whenever it changes, so the screen shows where things stand and how they've moved.
 */
export function TrackerDetail({ budget }: { budget: Budget }) {
  const navigate = useNavigate()
  const { folders, budgets, entries, snapshots, reorderEntries, renameBudget, report } = useData()
  const { sheet, open: setSheet, close } = useOverlay<Sheet>()
  const [renaming, setRenaming] = useState(false)
  // The entry whose note is open for editing, if any.
  const [editingNote, setEditingNote] = useState<string | null>(null)
  // As in BudgetDetail: the key lets a row that finishes saving late close only itself.
  const [draft, setDraft] = useState<{ key: number; type: EntryType } | null>(null)
  const startDraft = (type: EntryType) => setDraft({ key: Date.now(), type })
  const endDraft = (key: number) => setDraft((d) => (d?.key === key ? null : d))
  // The item whose value is open on the keypad, if any.
  const [editingAmount, setEditingAmount] = useState<string | null>(null)
  const closeAmount = useCallback(() => setEditingAmount(null), [])
  const hero = useHero()

  const folder = folders.find((f) => f.id === budget.folder)
  const backTo = folder ? `/folder/${folder.id}` : '/'
  const rows = entriesIn(entries, budget.id)
  const netWorth = balance(rows)
  // Savings and debts each have their own section, reordered within it.
  const ofType = (type: EntryType) => rows.filter((e) => e.type === type)
  // A section shows once it has something in it (or one is being added), so a budget
  // used for just one kind isn't cluttered with an empty section.
  const shown = (['saving', 'debt'] as const).filter((type) => ofType(type).length > 0 || draft?.type === type)
  const hidden = (['saving', 'debt'] as const).filter((type) => !shown.includes(type))
  const reorderWithin = (type: EntryType, ordered: Entry[]) =>
    reorderEntries(type === 'saving' ? [...ordered, ...ofType('debt')] : [...ofType('saving'), ...ordered])
  const openEntry = sheet && sheet.kind !== 'budgetMenu' ? rows.find((e) => e.id === sheet.id) : undefined

  const renderRow = (entry: Entry) => {
    const colour = typeColour(entry.type)
    const moved = changeSincePrevious(entry, snapshots)
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
            <LinkedFrom links={linkedInto(entry, entries, budgets)} budgets={budgets} />
          </div>
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
            amount={hero.scrolledPast && !renaming ? formatSigned(netWorth) : null}
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
          label="Net worth"
          amount={formatSigned(netWorth)}
          colour={balanceColour(netWorth)}
          amountRef={hero.amountRef}
          detail={
            shown.length === 2 && (
              <>
                <HeroPart type="saving" total={typeTotal(rows, 'saving')} /> · <HeroPart type="debt" total={typeTotal(rows, 'debt')} />
              </>
            )
          }
        />
        {rows.length === 0 && !draft && (
          <p className="px-8 pt-3 text-center text-sm text-muted">
            Add your savings and debts, like an ISA or a mortgage, with their current values. Tap a value
            to update it; each change is kept in its history.
          </p>
        )}
        {shown.map((type) => (
          <EntrySection key={type} type={type} total={typeTotal(rows, type)} onAdd={() => startDraft(type)}>
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
