import { useState } from 'react'
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
import { ReorderList } from '../components/ReorderList'
import { ActionSheet, NameSheet } from '../components/Sheet'
import { useData } from '../lib/data'
import { balanceColour, formatSigned } from '../lib/money'
import { isTracker, pb } from '../lib/pb'
import { budgetBalance, cardsIn, levelBalance, type Card } from '../lib/selectors'

type Sheet =
  | { kind: 'addBudget' }
  | { kind: 'addFolder' }
  | { kind: 'appMenu' }
  | { kind: 'cardMenu'; key: string }

// Serves both the root list and the inside of a folder.
export function BudgetList() {
  const { id } = useParams()
  const folderId = id ?? ''
  const { folders, budgets, entries, createBudget, createFolder, reorderCards } = useData()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = () => setSheet(null)

  const folder = folders.find((f) => f.id === folderId)
  if (id && !folder) return <Navigate to="/" replace />

  const parent = folders.find((f) => f.id === folder?.parent)
  const cards = cardsIn(folders, budgets, folderId)
  const total = levelBalance(budgets, entries, folderId)
  const openCard = sheet?.kind === 'cardMenu' ? cards.find((c) => c.key === sheet.key) : undefined

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
            <HeaderButton label="Add folder" onClick={() => setSheet({ kind: 'addFolder' })}>
              <FolderPlusIcon />
            </HeaderButton>
            {!folder && (
              <HeaderButton label="Menu" onClick={() => setSheet({ kind: 'appMenu' })}>
                <MenuIcon />
              </HeaderButton>
            )}
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {cards.length === 0 && (
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
              onMenu={() => setSheet({ kind: 'cardMenu', key: card.key })}
            />
          )}
        </ReorderList>
      </main>

      <footer className="shrink-0 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_4px_rgba(0,0,0,0.08)]">
        <div className="p-3 pb-2">
          <button
            type="button"
            onClick={() => setSheet({ kind: 'addBudget' })}
            className="w-full rounded-xl button-fill [--fill:var(--color-action)] py-3.5 font-bold"
          >
            Add Budget
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <span className="text-muted">{folder ? 'Folder Balance:' : 'All Budgets Balance:'}</span>
          <span className={`text-2xl font-bold whitespace-nowrap ${balanceColour(total)}`}>
            {formatSigned(total)}
          </span>
        </div>
      </footer>

      {sheet?.kind === 'addBudget' && (
        <NameSheet
          title="Add Budget"
          chooseKind
          folderLabel="Folder"
          initialFolder={folderId}
          onSave={createBudget}
          onClose={close}
        />
      )}
      {sheet?.kind === 'addFolder' && (
        <NameSheet
          title="Add Folder"
          folderLabel="Inside"
          initialFolder={folderId}
          onSave={createFolder}
          onClose={close}
        />
      )}
      {sheet?.kind === 'appMenu' && (
        <ActionSheet
          title={pb.authStore.record?.email ? `Signed in as ${pb.authStore.record.email}` : 'Menu'}
          onClose={close}
          actions={[{ label: 'Sign out', onClick: () => pb.authStore.clear() }]}
        />
      )}
      {openCard?.kind === 'budget' && <BudgetMenu budget={openCard.record} onClose={close} />}
      {openCard?.kind === 'folder' && <FolderMenu folder={openCard.record} onClose={close} />}
    </div>
  )
}

function CardRow({
  card,
  balance,
  onMenu,
}: {
  card: Card
  balance: number
  onMenu: () => void
}) {
  const isFolder = card.kind === 'folder'
  return (
    <div className="flex min-h-[68px] items-stretch rounded-xl bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
      <Link
        to={isFolder ? `/folder/${card.record.id}` : `/budget/${card.record.id}`}
        className="flex min-w-0 flex-1 items-center gap-2 pr-2 pl-4"
      >
        {isFolder && <FolderIcon />}
        <span className="min-w-0 flex-1 truncate text-text">{card.record.name}</span>
        {!isFolder && (
          // A savings & debts card shows net worth in brand colour, apart from money in and out.
          <span
            className={`font-bold whitespace-nowrap ${isTracker(card.record) ? 'text-brand' : balanceColour(balance)}`}
          >
            {formatSigned(balance)}
          </span>
        )}
        <ChevronIcon />
      </Link>
      <button
        type="button"
        aria-label={`Options for ${card.record.name}`}
        onClick={onMenu}
        className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-line text-brand"
      >
        <DotsIcon />
      </button>
    </div>
  )
}
