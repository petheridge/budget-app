import { useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BudgetMenu } from '../components/BudgetMenu'
import { FolderMenu } from '../components/FolderMenu'
import { Header, HeaderButton } from '../components/Header'
import {
  ChevronIcon,
  DotsIcon,
  FolderIcon,
  FolderPlusIcon,
  MenuIcon,
} from '../components/icons'
import { Menu } from '../components/Menu'
import { RenameInput } from '../components/RenameInput'
import { ReorderList } from '../components/ReorderList'
import { DraftCard } from '../components/DraftCard'
import { useOverlay } from '../components/useOverlay'
import { usePulse } from '../components/usePulse'
import { csvFileName, exportRows, saveFile, toCsv } from '../lib/csv'
import { useData } from '../lib/data'
import { balanceColour, formatSigned } from '../lib/money'
import { isTracker, pb, type BudgetKind } from '../lib/pb'
import { budgetBalance, cardsIn, levelBalance, type Card } from '../lib/selectors'

// Menus open from the button tapped (`anchor`).
type Sheet =
  | { kind: 'addMenu'; anchor: HTMLElement }
  | { kind: 'appMenu'; anchor: HTMLElement }
  | { kind: 'cardMenu'; key: string; anchor: HTMLElement }

// Serves both the root list and the inside of a folder.
export function BudgetList() {
  const { id } = useParams()
  const folderId = id ?? ''
  const { folders, budgets, entries, snapshots, createBudget, createFolder, reorderCards, renameBudget, renameFolder, report } =
    useData()
  const { sheet, open: setSheet, close } = useOverlay<Sheet>()
  // The card whose name is being edited in place, if any.
  const [renaming, setRenaming] = useState<string | null>(null)
  // A new budget or folder being typed in at the end of the list. The key starts a fresh one each time.
  const [draft, setDraft] = useState<{ key: number; kind: BudgetKind | 'folder' } | null>(null)
  const startDraft = (kind: BudgetKind | 'folder') => setDraft({ key: Date.now(), kind })
  const endDraft = (key: number) => setDraft((d) => (d?.key === key ? null : d))
  const addFrom = (kind: BudgetKind) => {
    close()
    startDraft(kind)
  }

  const folder = folders.find((f) => f.id === folderId)
  if (id && !folder) return <Navigate to="/" replace />

  const parent = folders.find((f) => f.id === folder?.parent)
  const cards = cardsIn(folders, budgets, folderId)
  const total = levelBalance(budgets, entries, folderId)
  // Savings & debts aren't in the balance, so with no regular budget here there's nothing to show.
  const showBalance = budgets.some((b) => b.folder === folderId && !isTracker(b))
  const openCard = sheet?.kind === 'cardMenu' ? cards.find((c) => c.key === sheet.key) : undefined

  function rename(card: Card, name: string | null) {
    setRenaming(null)
    if (!name) return
    if (card.kind === 'budget') report('rename the budget', renameBudget(card.record.id, name))
    else report('rename the folder', renameFolder(card.record.id, name))
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title={
          folder ? (
            <>
              <FolderIcon className="size-5 shrink-0 text-white" />
              <span className="truncate">{folder.name}</span>
            </>
          ) : (
            'Budgets'
          )
        }
        back={
          folder && {
            to: parent ? `/folder/${parent.id}` : '/',
            label: parent?.name ?? 'Budgets',
            isFolder: !!parent,
          }
        }
        actions={
          <>
            <HeaderButton label="Add folder" onClick={() => startDraft('folder')}>
              <FolderPlusIcon />
            </HeaderButton>
            {!folder && (
              <HeaderButton label="Menu" opensMenu onClick={(anchor) => setSheet({ kind: 'appMenu', anchor })}>
                <MenuIcon />
              </HeaderButton>
            )}
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {cards.length === 0 && !draft && (
          <p className="p-8 text-center text-muted">Nothing here yet. Add a budget to get started.</p>
        )}
        <ReorderList
          items={cards}
          getId={(card) => card.key}
          onReorder={reorderCards}
          className="flex flex-col gap-2.5"
        >
          {(card) => (
            <CardRow
              card={card}
              balance={card.kind === 'budget' ? budgetBalance(entries, card.record.id) : 0}
              onMenu={(anchor) => setSheet({ kind: 'cardMenu', key: card.key, anchor })}
              renaming={renaming === card.key}
              onRenamed={(name) => rename(card, name)}
            />
          )}
        </ReorderList>
        {draft && (
          <DraftCard
            key={draft.key}
            kind={draft.kind === 'folder' ? 'folder' : 'budget'}
            label={draft.kind === 'folder' ? 'New folder name' : 'New budget name'}
            placeholder={
              draft.kind === 'folder' ? 'Folder name' : draft.kind === 'tracker' ? 'E.g. Net worth' : 'E.g. Monthly'
            }
            onSave={(name) =>
              draft.kind === 'folder' ? createFolder(name, folderId) : createBudget(name, folderId, draft.kind)
            }
            onDone={() => endDraft(draft.key)}
          />
        )}
      </main>

      <footer className="shrink-0 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_4px_rgba(0,0,0,0.08)]">
        <div className={showBalance ? 'p-3 pb-2' : 'p-3'}>
          <button
            type="button"
            aria-haspopup="menu"
            onClick={(event) => setSheet({ kind: 'addMenu', anchor: event.currentTarget })}
            className="press w-full rounded-xl button-fill [--fill:var(--color-action)] py-3.5 font-bold"
          >
            Add Budget
          </button>
        </div>
        {showBalance && (
          <div className="flex items-center justify-between gap-2 px-4 pb-3">
            <span className="text-muted">{folder ? 'Folder Balance:' : 'All Budgets Balance:'}</span>
            <LevelTotal total={total} />
          </div>
        )}
      </footer>

      {sheet?.kind === 'addMenu' && (
        <Menu
          key={sheet.instance}
          anchor={sheet.anchor}
          label="Add"
          onClose={close}
          items={[
            { label: 'Budget', hint: 'Income and outgoings', onSelect: () => addFrom('budget') },
            { label: 'Savings & debts', hint: 'Values tracked over time', onSelect: () => addFrom('tracker') },
          ]}
        />
      )}
      {sheet?.kind === 'appMenu' && (
        <Menu
          key={sheet.instance}
          anchor={sheet.anchor}
          label="Menu"
          title={pb.authStore.record?.email ? `Signed in as ${pb.authStore.record.email}` : undefined}
          onClose={close}
          items={[
            {
              label: 'Export as CSV',
              hint: 'Every budget, as a spreadsheet file',
              onSelect: () => {
                close()
                const csv = toCsv(exportRows({ folders, budgets, entries, snapshots }))
                report('export the budgets', saveFile(csvFileName('budgets'), csv))
              },
            },
            { label: 'Sign out', onSelect: () => pb.authStore.clear() },
          ]}
        />
      )}
      {sheet?.kind === 'cardMenu' && openCard?.kind === 'budget' && (
        <BudgetMenu
          key={sheet.instance}
          budget={openCard.record}
          anchor={sheet.anchor}
          onClose={close}
          onRename={() => setRenaming(openCard.key)}
          onDuplicated={(copy) => setRenaming(`budget:${copy}`)}
        />
      )}
      {sheet?.kind === 'cardMenu' && openCard?.kind === 'folder' && (
        <FolderMenu
          key={sheet.instance}
          folder={openCard.record}
          anchor={sheet.anchor}
          onClose={close}
          onRename={() => setRenaming(openCard.key)}
        />
      )}
    </div>
  )
}

function CardRow({
  card,
  balance,
  onMenu,
  renaming,
  onRenamed,
}: {
  card: Card
  balance: number
  onMenu: (anchor: HTMLElement) => void
  renaming: boolean
  onRenamed: (name: string | null) => void
}) {
  const isFolder = card.kind === 'folder'
  const inner = (
    <>
      {isFolder && <FolderIcon />}
      {renaming ? (
        <span className="min-w-0 flex-1">
          <RenameInput
            value={card.record.name}
            label={`Name for ${card.record.name}`}
            onDone={onRenamed}
            className="bg-bg text-text ring-2 ring-brand ring-inset"
          />
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-text">{card.record.name}</span>
      )}
      {!isFolder && (
        // A savings & debts card shows net worth in brand colour, apart from money in and out.
        <span
          className={`font-bold whitespace-nowrap ${isTracker(card.record) ? 'text-brand' : balanceColour(balance)}`}
        >
          {formatSigned(balance)}
        </span>
      )}
      <ChevronIcon />
    </>
  )
  const layout = 'flex min-w-0 flex-1 items-center gap-2 pr-2 pl-4'
  return (
    <div className="flex min-h-[68px] items-stretch rounded-xl bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
      {/* While renaming, a tap in the card mustn't open it. */}
      {renaming ? (
        <div className={layout}>{inner}</div>
      ) : (
        <Link to={isFolder ? `/folder/${card.record.id}` : `/budget/${card.record.id}`} className={layout}>
          {inner}
        </Link>
      )}
      <button
        type="button"
        aria-label={`Options for ${card.record.name}`}
        aria-haspopup="menu"
        onClick={(event) => onMenu(event.currentTarget)}
        className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-line text-brand"
      >
        <DotsIcon />
      </button>
    </div>
  )
}

/** The footer's total, which pulses when it changes. */
function LevelTotal({ total }: { total: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  usePulse(total, ref)
  return (
    <span ref={ref} className={`text-2xl font-bold whitespace-nowrap ${balanceColour(total)}`}>
      {formatSigned(total)}
    </span>
  )
}
