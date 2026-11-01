import type { RecordModel, RecordService } from 'pocketbase'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { EntryType } from './money'
import { pb, type Budget, type BudgetKind, type Entry, type Folder, type Snapshot } from './pb'
import { bySortOrder, cardsIn, nextSortOrder, type Card } from './selectors'

type Stored = RecordModel & { sort_order?: number; created: string }

const byCreated = (a: Stored, b: Stored) => a.created.localeCompare(b.created)
const byOrder = (a: Stored, b: Stored) => bySortOrder({ sort_order: 0, ...a }, { sort_order: 0, ...b })

/** One collection, kept in memory and in step with the server over realtime. */
function useRecords<T extends Stored>(
  name: 'folders' | 'budgets' | 'entries' | 'snapshots',
  ordered = true,
) {
  const service = useRef(pb.collection(name) as unknown as RecordService<T>).current
  const [records, setRecords] = useState<T[]>([])
  // Folders, budgets and entries have a user-set order; snapshots are kept by date.
  const order = ordered ? byOrder : byCreated

  const load = useCallback(async () => {
    setRecords(await service.getFullList({ sort: ordered ? 'sort_order,created' : 'created' }))
  }, [service, ordered])

  const upsert = useCallback(
    (record: T) => {
      setRecords((current) => [...current.filter((r) => r.id !== record.id), record].sort(order))
    },
    [order],
  )

  const drop = useCallback((id: string) => {
    setRecords((current) => current.filter((r) => r.id !== id))
  }, [])

  const dropWhere = useCallback((test: (record: T) => boolean) => {
    setRecords((current) => current.filter((r) => !test(r)))
  }, [])

  const updateWhere = useCallback((test: (record: T) => boolean, change: (record: T) => T) => {
    setRecords((current) => current.map((r) => (test(r) ? change(r) : r)))
  }, [])

  useEffect(() => {
    const subscription = service.subscribe('*', ({ action, record }) => {
      if (action === 'delete') drop(record.id)
      else upsert(record)
    })
    return () => {
      subscription.then((unsubscribe) => unsubscribe()).catch(() => {})
    }
  }, [service, upsert, drop])

  /** Updates the screen immediately, then writes only the records that actually moved. */
  const applySortOrders = useCallback(
    (orders: Map<string, number>) => {
      const moved = records.filter((r) => orders.has(r.id) && orders.get(r.id) !== r.sort_order)
      setRecords((current) =>
        current
          .map((r) => (orders.has(r.id) ? { ...r, sort_order: orders.get(r.id)! } : r))
          .sort(order),
      )
      return Promise.all(moved.map((r) => service.update(r.id, { sort_order: orders.get(r.id) })))
    },
    [records, service, order],
  )

  return { records, service, load, upsert, drop, dropWhere, updateWhere, applySortOrders }
}

export interface EntryFields {
  name: string
  amount_pence: number
  type: EntryType
  note: string
}

/** Saving and debt values are recorded with a date each time they change. */
const isTrackedType = (type: EntryType) => type === 'saving' || type === 'debt'

function useStore() {
  const folders = useRecords<Folder>('folders')
  const budgets = useRecords<Budget>('budgets')
  const entries = useRecords<Entry>('entries')
  const snapshots = useRecords<Snapshot>('snapshots', false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState('')

  /**
   * Deletes wait a few seconds so they can be undone: the item is hidden at once,
   * and only deleted for real when the time is up, another delete starts, or the
   * app goes to the background. One at a time.
   */
  const pendingDelete = useRef<{ kind: 'entry' | 'budget'; id: string; timer: number } | null>(null)
  const [hiddenId, setHiddenId] = useState<string | null>(null)
  const [undoLabel, setUndoLabel] = useState('')

  const loadFolders = folders.load
  const loadBudgets = budgets.load
  const loadEntries = entries.load
  const loadSnapshots = snapshots.load

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadFolders(), loadBudgets(), loadEntries(), loadSnapshots()])
      setStatus('ready')
    } catch (error) {
      if ((error as { status?: number }).status === 401) pb.authStore.clear()
      // A failed background refresh shouldn't take away a screen that's already showing.
      setStatus((current) => (current === 'ready' ? current : 'error'))
    }
  }, [loadFolders, loadBudgets, loadEntries, loadSnapshots])

  useEffect(() => {
    void refresh()
    // Keeps the session alive for as long as the app gets used.
    pb.collection('users')
      .authRefresh()
      .catch((error) => {
        if (error.status === 401) pb.authStore.clear()
      })

    // Catch up on whatever was missed while disconnected or in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    const connect = pb.realtime.subscribe('PB_CONNECT', () => void refresh())
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      connect.then((unsubscribe) => unsubscribe()).catch(() => {})
    }
  }, [refresh])

  const record = async (entry: string, amount_pence: number) => {
    snapshots.upsert(await snapshots.service.create({ entry, amount_pence }))
  }

  const commitDelete = () => {
    const pending = pendingDelete.current
    if (!pending) return
    window.clearTimeout(pending.timer)
    pendingDelete.current = null
    const { kind, id } = pending
    if (kind === 'entry') {
      entries.drop(id)
      // The server deletes its snapshots too, and clears any links to it.
      snapshots.dropWhere((s) => s.entry === id)
      entries.updateWhere((e) => e.link === id, (e) => ({ ...e, link: '' }))
      guard('delete the entry', entries.service.delete(id))
    } else {
      budgets.drop(id)
      guard('delete the budget', budgets.service.delete(id))
    }
    setHiddenId(null)
    setUndoLabel('')
  }
  const commitRef = useRef(commitDelete)
  commitRef.current = commitDelete

  const startDelete = (kind: 'entry' | 'budget', id: string, label: string) => {
    commitDelete()
    pendingDelete.current = { kind, id, timer: window.setTimeout(() => commitRef.current(), UNDO_SECONDS * 1000) }
    setHiddenId(id)
    setUndoLabel(label)
  }

  // Leaving the app makes a waiting delete final, so it isn't lost if iOS closes the app.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') commitRef.current()
    }
    const flushNow = () => commitRef.current()
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flushNow)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flushNow)
    }
  }, [])

  /** For changes already shown on screen: if the save fails, say so and restore the real state. */
  const guard = (action: string, write: Promise<unknown>) => {
    write.catch(() => {
      setProblem(`Couldn't ${action}. Please try again.`)
      void refresh()
    })
  }

  return {
    folders: folders.records,
    // An item waiting to be deleted is hidden everywhere until it's undone or gone.
    budgets: budgets.records.filter((b) => b.id !== hiddenId),
    entries: entries.records.filter((e) => e.id !== hiddenId),
    snapshots: snapshots.records,
    status,
    problem,
    clearProblem: () => setProblem(''),
    /** "Deleted …" while a delete can still be undone, else ''. */
    undoLabel,
    undoDelete() {
      const pending = pendingDelete.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      pendingDelete.current = null
      setHiddenId(null)
      setUndoLabel('')
    },
    refresh,

    async createFolder(name: string, parent: string) {
      const siblings = cardsIn(folders.records, budgets.records, parent).map((c) => c.record)
      folders.upsert(
        await folders.service.create({ name, parent, sort_order: nextSortOrder(siblings) }),
      )
    },
    async renameFolder(id: string, name: string) {
      folders.upsert(await folders.service.update(id, { name }))
    },
    deleteFolder(id: string) {
      commitDelete()
      folders.drop(id)
      guard('delete the folder', folders.service.delete(id))
    },

    async createBudget(name: string, folder: string, kind: BudgetKind = 'budget') {
      const siblings = cardsIn(folders.records, budgets.records, folder).map((c) => c.record)
      budgets.upsert(
        await budgets.service.create({ name, folder, kind, sort_order: nextSortOrder(siblings) }),
      )
    },
    /** Only offered for empty budgets, so no entry ends up with the wrong kind of type. */
    async setBudgetKind(id: string, kind: BudgetKind) {
      budgets.upsert(await budgets.service.update(id, { kind }))
    },
    async renameBudget(id: string, name: string) {
      budgets.upsert(await budgets.service.update(id, { name }))
    },
    async moveBudget(id: string, folder: string) {
      const siblings = cardsIn(folders.records, budgets.records, folder).map((c) => c.record)
      budgets.upsert(
        await budgets.service.update(id, { folder, sort_order: nextSortOrder(siblings) }),
      )
    },
    deleteBudget(id: string) {
      const budget = budgets.records.find((b) => b.id === id)
      const count = entries.records.filter((e) => e.budget === id).length
      const what = count === 0 ? '' : count === 1 ? ' and its entry' : ` and its ${count} entries`
      startDelete('budget', id, `Deleted “${budget?.name ?? 'budget'}”${what}`)
    },

    async createEntry(budget: string, fields: EntryFields) {
      const siblings = entries.records.filter((e) => e.budget === budget)
      const entry = await entries.service.create({
        ...fields,
        budget,
        sort_order: nextSortOrder(siblings),
      })
      entries.upsert(entry)
      if (isTrackedType(entry.type)) await record(entry.id, entry.amount_pence)
    },
    async updateEntry(id: string, fields: EntryFields) {
      const before = entries.records.find((e) => e.id === id)
      const entry = await entries.service.update(id, { ...fields })
      entries.upsert(entry)
      if (isTrackedType(entry.type) && entry.amount_pence !== before?.amount_pence) {
        await record(entry.id, entry.amount_pence)
      }
    },
    /** Links a budget expense to the saving or debt it pays into ('' to unlink). */
    async setEntryLink(id: string, link: string) {
      entries.upsert(await entries.service.update(id, { link }))
    },
    deleteEntry(id: string) {
      const entry = entries.records.find((e) => e.id === id)
      startDelete('entry', id, `Deleted “${entry?.name ?? 'entry'}”`)
    },
    /**
     * Monthly catch-up: records today's value for every item in a savings &
     * debts budget, changed or not, so each catch-up is complete in the history.
     */
    async catchUp(values: Map<string, number>) {
      await Promise.all(
        [...values].map(async ([id, amount_pence]) => {
          const before = entries.records.find((e) => e.id === id)
          if (before && before.amount_pence !== amount_pence) {
            entries.upsert(await entries.service.update(id, { amount_pence }))
          }
          await record(id, amount_pence)
        }),
      )
    },

    reorderCards(cards: Card[]) {
      const orderOf = (kind: Card['kind']) =>
        new Map(cards.flatMap((c, i) => (c.kind === kind ? [[c.record.id, i] as const] : [])))
      guard(
        'save the new order',
        Promise.all([
          folders.applySortOrders(orderOf('folder')),
          budgets.applySortOrders(orderOf('budget')),
        ]),
      )
    },
    reorderEntries(ordered: Entry[]) {
      guard(
        'save the new order',
        entries.applySortOrders(new Map(ordered.map((e, i) => [e.id, i]))),
      )
    },
  }
}

/** How long a delete can be undone. */
export const UNDO_SECONDS = 6

const DataContext = createContext<ReturnType<typeof useStore> | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  return <DataContext.Provider value={useStore()}>{children}</DataContext.Provider>
}

export function useData() {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData must be used inside DataProvider')
  return data
}
