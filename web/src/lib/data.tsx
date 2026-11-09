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
import { formatUnsigned, type EntryType } from './money'
import { formatDay } from './dates'
import { pb, type Budget, type BudgetKind, type Entry, type Folder, type Snapshot } from './pb'
import { bySortOrder, cardsIn, historyOf, nextSortOrder, type Card } from './selectors'

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
  /** A budget expense that has been paid. */
  paid?: boolean
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
  // False while the server can't be reached, so the screen can say that changes won't save.
  const [connected, setConnected] = useState(() => navigator.onLine)

  /**
   * Deletes wait a few seconds so they can be undone: the item is hidden at once,
   * and only deleted for real when the time is up, another delete starts, or the
   * app goes to the background. One at a time.
   */
  const pendingDelete = useRef<{
    kind: DeleteKind
    id: string
    timer: number
    /** Deleting a saving's or debt's newest value puts its current value back to the one before. */
    revert?: { entry: string; to: number; from: number }
  } | null>(null)
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
    const connect = pb.realtime.subscribe('PB_CONNECT', () => {
      setConnected(true)
      void refresh()
    })
    // The realtime connection dropping is how a server that's down shows itself; the
    // SDK keeps trying, and PB_CONNECT says when it's back.
    pb.realtime.onDisconnect = (subscriptions) => {
      if (subscriptions.length > 0) setConnected(false)
    }
    const onOffline = () => setConnected(false)
    const onOnline = () => {
      setConnected(true)
      void refresh()
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      pb.realtime.onDisconnect = undefined
      connect.then((unsubscribe) => unsubscribe()).catch(() => {})
    }
  }, [refresh])

  /**
   * Adds a value to a saving's or debt's history. The value itself is already saved by
   * then, so a failure here is reported rather than thrown: the caller's save worked.
   */
  const record = (entry: string, amount_pence: number) => {
    guard(
      'add the value to its history',
      snapshots.service.create({ entry, amount_pence }).then((snapshot) => snapshots.upsert(snapshot)),
      false,
    )
  }

  /**
   * Makes a waiting delete final. Resolves once the server has answered, so that a
   * write which follows (such as a new value for the same saving) lands after it.
   */
  const commitDelete = (): Promise<unknown> => {
    const pending = pendingDelete.current
    if (!pending) return Promise.resolve()
    window.clearTimeout(pending.timer)
    pendingDelete.current = null
    const { kind, id } = pending
    const writes: Promise<unknown>[] = []
    if (kind === 'snapshot') {
      snapshots.drop(id)
      writes.push(snapshots.service.delete(id))
      // Saved directly, not through updateEntry, so it doesn't record a new value.
      const revert = pending.revert
      if (revert) writes.push(entries.service.update(revert.entry, { amount_pence: revert.to }))
      for (const write of writes) guard('delete the value', write)
    } else if (kind === 'entry') {
      entries.drop(id)
      // The server deletes its snapshots too, and clears any links to it.
      snapshots.dropWhere((s) => s.entry === id)
      entries.updateWhere((e) => e.link === id, (e) => ({ ...e, link: '' }))
      writes.push(entries.service.delete(id))
      guard('delete the entry', writes[0])
    } else {
      budgets.drop(id)
      writes.push(budgets.service.delete(id))
      guard('delete the budget', writes[0])
    }
    setHiddenId(null)
    setUndoLabel('')
    return Promise.allSettled(writes)
  }
  const commitRef = useRef(commitDelete)
  commitRef.current = commitDelete

  const startDelete = (
    kind: DeleteKind,
    id: string,
    label: string,
    revert?: { entry: string; to: number; from: number },
  ) => {
    void commitDelete()
    pendingDelete.current = {
      kind,
      id,
      revert,
      timer: window.setTimeout(() => void commitRef.current(), UNDO_SECONDS * 1000),
    }
    if (revert) entries.updateWhere((e) => e.id === revert.entry, (e) => ({ ...e, amount_pence: revert.to }))
    setHiddenId(id)
    setUndoLabel(label)
  }

  // Leaving the app makes a waiting delete final, so it isn't lost if iOS closes the app.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') void commitRef.current()
    }
    const flushNow = () => void commitRef.current()
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flushNow)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flushNow)
    }
  }, [])

  /**
   * For changes already shown on screen: if the save fails, say so and restore the real
   * state. `retry` is false where trying again wouldn't help (the rest of the change worked).
   */
  const guard = (action: string, write: Promise<unknown>, retry = true) => {
    write.catch(() => {
      setProblem(`Couldn't ${action}.${retry ? ' Please try again.' : ''}`)
      void refresh()
    })
  }

  return {
    folders: folders.records,
    // An item waiting to be deleted is hidden everywhere until it's undone or gone.
    budgets: budgets.records.filter((b) => b.id !== hiddenId),
    entries: entries.records.filter((e) => e.id !== hiddenId),
    snapshots: snapshots.records.filter((s) => s.id !== hiddenId),
    status,
    connected,
    problem,
    clearProblem: () => setProblem(''),
    /** For a change already shown on screen: if `write` fails, says so and reloads. */
    report: guard,
    /** "Deleted …" while a delete can still be undone, else ''. */
    undoLabel,
    undoDelete() {
      const pending = pendingDelete.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      pendingDelete.current = null
      const revert = pending.revert
      if (revert) entries.updateWhere((e) => e.id === revert.entry, (e) => ({ ...e, amount_pence: revert.from }))
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
      // Shown straight away, as it's typed in place.
      folders.updateWhere((f) => f.id === id, (f) => ({ ...f, name }))
      folders.upsert(await folders.service.update(id, { name }))
    },
    async moveFolder(id: string, parent: string) {
      const siblings = cardsIn(folders.records, budgets.records, parent).map((c) => c.record)
      folders.upsert(await folders.service.update(id, { parent, sort_order: nextSortOrder(siblings) }))
    },
    deleteFolder(id: string) {
      void commitDelete()
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
      budgets.updateWhere((b) => b.id === id, (b) => ({ ...b, name }))
      budgets.upsert(await budgets.service.update(id, { name }))
    },
    async moveBudget(id: string, folder: string) {
      const siblings = cardsIn(folders.records, budgets.records, folder).map((c) => c.record)
      budgets.upsert(
        await budgets.service.update(id, { folder, sort_order: nextSortOrder(siblings) }),
      )
    },
    /**
     * Copies a budget and its entries into the same folder, as "Name copy", and gives
     * back the copy's id. Paid ticks aren't copied: a copy is usually next month's.
     * If an entry fails part-way, what was copied stays (it can be deleted, with Undo).
     */
    async duplicateBudget(id: string): Promise<string> {
      const source = budgets.records.find((b) => b.id === id)
      if (!source) throw new Error('No such budget')
      const siblings = cardsIn(folders.records, budgets.records, source.folder).map((c) => c.record)
      const copy = await budgets.service.create({
        name: `${source.name} copy`,
        folder: source.folder,
        kind: source.kind,
        sort_order: nextSortOrder(siblings),
      })
      budgets.upsert(copy)
      // One at a time, so they're created in order.
      for (const entry of entries.records.filter((e) => e.budget === id && e.id !== hiddenId)) {
        const { name, amount_pence, type, note, sort_order } = entry
        entries.upsert(
          await entries.service.create({ budget: copy.id, name, amount_pence, type, note, sort_order, link: entry.link ?? '' }),
        )
      }
      return copy.id
    },
    deleteBudget(id: string) {
      const budget = budgets.records.find((b) => b.id === id)
      const count = entries.records.filter((e) => e.budget === id).length
      const what = count === 0 ? '' : count === 1 ? ' and its entry' : ` and its ${count} entries`
      startDelete('budget', id, `Deleted “${budget?.name ?? 'budget'}”${what}`)
    },

    async createEntry(budget: string, fields: EntryFields) {
      // A waiting delete goes first, so writes reach the server in the order they were made.
      await commitDelete()
      const siblings = entries.records.filter((e) => e.budget === budget)
      const entry = await entries.service.create({
        ...fields,
        budget,
        sort_order: nextSortOrder(siblings),
      })
      entries.upsert(entry)
      if (isTrackedType(entry.type)) record(entry.id, entry.amount_pence)
    },
    /** Saves only the fields given, so two phones changing different things don't undo each other. */
    async updateEntry(id: string, fields: Partial<EntryFields>) {
      // Deleting a saving's newest value puts its current value back; that must be
      // saved before this change, not after it.
      await commitDelete()
      const before = entries.records.find((e) => e.id === id)
      const entry = await entries.service.update(id, { ...fields })
      entries.upsert(entry)
      if (isTrackedType(entry.type) && fields.amount_pence !== undefined && entry.amount_pence !== before?.amount_pence) {
        record(entry.id, entry.amount_pence)
      }
    },
    /** Links a budget expense to the saving or debt it pays into ('' to unlink). */
    async setEntryLink(id: string, link: string) {
      await commitDelete()
      entries.upsert(await entries.service.update(id, { link }))
    },
    /** Moves an entry to the end of its section in another budget of the same kind. */
    async moveEntry(id: string, budget: string) {
      await commitDelete()
      const siblings = entries.records.filter((e) => e.budget === budget)
      entries.upsert(await entries.service.update(id, { budget, sort_order: nextSortOrder(siblings) }))
    },
    /**
     * Deletes one recorded value of a saving or debt, with Undo. Deleting the newest
     * puts the item's current value back to the one before it. An item's only
     * value can't be deleted: it needs one (delete the item instead).
     */
    deleteSnapshot(id: string): boolean {
      const snapshot = snapshots.records.find((s) => s.id === id)
      if (!snapshot) return false
      const history = historyOf(
        snapshots.records.filter((s) => s.id !== hiddenId),
        snapshot.entry,
      )
      if (history.length < 2) return false
      const entry = entries.records.find((e) => e.id === snapshot.entry)
      const newest = history[0].id === id
      const label = `Deleted ${formatUnsigned(snapshot.amount_pence)} from ${formatDay(snapshot.created, true)}`
      startDelete(
        'snapshot',
        id,
        label,
        newest && entry ? { entry: entry.id, to: history[1].amount_pence, from: entry.amount_pence } : undefined,
      )
      return true
    },
    deleteEntry(id: string) {
      const entry = entries.records.find((e) => e.id === id)
      startDelete('entry', id, `Deleted “${entry?.name ?? 'entry'}”`)
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

type DeleteKind = 'entry' | 'budget' | 'snapshot'

/** How long a delete can be undone. */
export const UNDO_SECONDS = 6

const DataContext = createContext<ReturnType<typeof useStore> | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  return <DataContext.Provider value={useStore()}>{children}</DataContext.Provider>
}

/** False while the server can't be reached. True outside the signed-in screens, which hold no data. */
export function useConnected(): boolean {
  return useContext(DataContext)?.connected ?? true
}

export function useData() {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData must be used inside DataProvider')
  return data
}
