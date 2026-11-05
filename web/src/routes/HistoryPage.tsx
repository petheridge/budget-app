import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ChangeText, formatDay } from '../components/Change'
import { Header } from '../components/Header'
import { useData } from '../lib/data'
import { formatUnsigned, isGoodChange, typeColour } from '../lib/money'
import { historyOf } from '../lib/selectors'

/**
 * A saving's or debt's own screen: every recorded value, newest first, with the
 * change each time. Swipe a value left to delete it (with Undo); deleting the
 * newest puts the item's current value back to the one before. The only value
 * can't be deleted.
 */
export function HistoryPage() {
  const { id } = useParams()
  const { entries, budgets, snapshots, deleteSnapshot } = useData()
  // The row swiped open, if any: one at a time.
  const [openId, setOpenId] = useState<string | null>(null)

  const entry = entries.find((e) => e.id === id)
  const budget = budgets.find((b) => b.id === entry?.budget)
  if (!entry || !budget) return <Navigate to="/" replace />

  const history = historyOf(snapshots, entry.id)
  const canDelete = history.length > 1

  return (
    <div className="flex h-full flex-col">
      <Header
        title={<span className="truncate">History</span>}
        back={{ to: `/budget/${budget.id}`, label: budget.name, isFolder: false }}
      />
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="px-4 pt-4 pb-3 text-center">
          <h2 className={`truncate text-lg font-semibold ${typeColour(entry.type)}`}>{entry.name}</h2>
          {canDelete && <p className="text-xs text-muted">Swipe a value left to delete it.</p>}
        </div>
        {history.length === 0 ? (
          <p className="py-6 text-center text-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="border-t border-line bg-surface">
            {history.map((snapshot, i) => {
              const older = history[i + 1]
              const change = older ? snapshot.amount_pence - older.amount_pence : null
              const day = formatDay(snapshot.created, true)
              return (
                <SwipeToDelete
                  key={snapshot.id}
                  enabled={canDelete}
                  open={openId === snapshot.id}
                  onOpen={() => setOpenId(snapshot.id)}
                  onClose={() => setOpenId((id) => (id === snapshot.id ? null : id))}
                  onDelete={() => {
                    setOpenId(null)
                    deleteSnapshot(snapshot.id)
                  }}
                  label={`Delete ${formatUnsigned(snapshot.amount_pence)} from ${day}`}
                >
                  <span className="text-text">{day}</span>
                  <span className="text-right">
                    <span className="block font-semibold whitespace-nowrap text-text">
                      {formatUnsigned(snapshot.amount_pence)}
                    </span>
                    {change !== null && (
                      <span className="block whitespace-nowrap">
                        <ChangeText change={change} good={isGoodChange(entry.type, change)} />
                      </span>
                    )}
                  </span>
                </SwipeToDelete>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}

/** How far a row slides to show its Delete button, in pixels. */
const REVEAL = 88

/**
 * A row that slides left under a finger (or mouse) to show a Delete button
 * behind it, as in iOS lists. A mostly vertical move scrolls instead. Tapping the
 * open row, or swiping it back, closes it.
 */
function SwipeToDelete({
  enabled,
  open,
  onOpen,
  onClose,
  onDelete,
  label,
  children,
}: {
  enabled: boolean
  open: boolean
  onOpen: () => void
  onClose: () => void
  onDelete: () => void
  label: string
  children: ReactNode
}) {
  // While a finger is down: where it started, and whether this is a swipe or a scroll.
  const gesture = useRef<{ x: number; y: number; from: number; mode: 'undecided' | 'swipe' | 'scroll' } | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const settled = open ? -REVEAL : 0
  const offset = drag ?? settled

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled) return
    gesture.current = { x: event.clientX, y: event.clientY, from: settled, mode: 'undecided' }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g) return
    const dx = event.clientX - g.x
    const dy = event.clientY - g.y
    if (g.mode === 'undecided') {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        g.mode = 'swipe'
        event.currentTarget.setPointerCapture(event.pointerId)
      } else if (Math.abs(dy) > 8) {
        g.mode = 'scroll'
      }
    }
    if (g.mode === 'swipe') setDrag(Math.max(-REVEAL * 1.4, Math.min(0, g.from + dx)))
  }

  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.mode === 'swipe') {
      // Past halfway it opens; otherwise it closes.
      if ((drag ?? settled) < -REVEAL / 2) onOpen()
      else onClose()
    } else if (g.mode === 'undecided' && open) {
      onClose()
    }
    setDrag(null)
  }

  return (
    <li className="relative border-b border-line">
      {enabled && (
        <button
          type="button"
          aria-label={label}
          onClick={onDelete}
          // Keyboard users reach it by tabbing; that opens the row too.
          onFocus={onOpen}
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-expense font-bold text-white"
          style={{ width: REVEAL }}
        >
          Delete
        </button>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex touch-pan-y items-center justify-between gap-3 bg-surface px-4 py-3 select-none ${drag === null ? 'transition-transform duration-200' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </li>
  )
}
