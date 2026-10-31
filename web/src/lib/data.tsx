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
import { pb, type Budget, type Entry, type Folder } from './pb'
import { bySortOrder, cardsIn, nextSortOrder, type Card } from './selectors'

type Ordered = RecordModel & { sort_order: number; created: string }

/** One collection, kept in memory and in step with the server over realtime. */
function useRecords<T extends Ordered>(name: 'folders' | 'budgets' | 'entries') {
  const service = useRef(pb.collection(name) as unknown as RecordService<T>).current
  const [records, setRecords] = useState<T[]>([])

  const load = useCallback(async () => {
    setRecords(await service.getFullList({ sort: 'sort_order,created' }))
  }, [service])

  const upsert = useCallback((record: T) => {
    setRecords((current) =>
      [...current.filter((r) => r.id !== record.id), record].sort(bySortOrder),
    )
  }, [])

  const drop = useCallback((id: string) => {
    setRecords((current) => current.filter((r) => r.id !== id))
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
          .sort(bySortOrder),
      )
      return Promise.all(moved.map((r) => service.update(r.id, { sort_order: orders.get(r.id) })))
    },
    [records, service],
  )

  return { records, service, load, upsert, drop, applySortOrders }
}

export interface EntryFields {
  name: string
  amount_pence: number
  type: EntryType
  note: string
}

function useStore() {
  const folders = useRecords<Folder>('folders')
  const budgets = useRecords<Budget>('budgets')
  const entries = useRecords<Entry>('entries')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState('')

  const loadFolders = folders.load
  const loadBudgets = budgets.load
  const loadEntries = entries.load

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadFolders(), loadBudgets(), loadEntries()])
      setStatus('ready')
    } catch (error) {
      if ((error as { status?: number }).status === 401) pb.authStore.clear()
      // A failed background refresh shouldn't take away a screen that's already showing.
      setStatus((current) => (current === 'ready' ? current : 'error'))
    }
  }, [loadFolders, loadBudgets, loadEntries])

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

  /** For changes already shown on screen: if the save fails, say so and restore the real state. */
  const guard = (action: string, write: Promise<unknown>) => {
    write.catch(() => {
      setProblem(`Couldn't ${action}. Please try again.`)
      void refresh()
    })
  }

  return {
    folders: folders.records,
    budgets: budgets.records,
    entries: entries.records,
    status,
    problem,
    clearProblem: () => setProblem(''),
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
      folders.drop(id)
      guard('delete the folder', folders.service.delete(id))
    },

    async createBudget(name: string, folder: string) {
      const siblings = cardsIn(folders.records, budgets.records, folder).map((c) => c.record)
      budgets.upsert(
        await budgets.service.create({ name, folder, sort_order: nextSortOrder(siblings) }),
      )
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
      budgets.drop(id)
      guard('delete the budget', budgets.service.delete(id))
    },

    async createEntry(budget: string, fields: EntryFields) {
      const siblings = entries.records.filter((e) => e.budget === budget)
      entries.upsert(
        await entries.service.create({ ...fields, budget, sort_order: nextSortOrder(siblings) }),
      )
    },
    async updateEntry(id: string, fields: EntryFields) {
      entries.upsert(await entries.service.update(id, { ...fields }))
    },
    deleteEntry(id: string) {
      entries.drop(id)
      guard('delete the entry', entries.service.delete(id))
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

const DataContext = createContext<ReturnType<typeof useStore> | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  return <DataContext.Provider value={useStore()}>{children}</DataContext.Provider>
}

export function useData() {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData must be used inside DataProvider')
  return data
}
