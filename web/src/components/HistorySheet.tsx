import { useData } from '../lib/data'
import { formatUnsigned, isGoodChange, typeColour } from '../lib/money'
import type { Entry } from '../lib/pb'
import { historyOf } from '../lib/selectors'
import { ChangeText, formatDay } from './Change'
import { SheetFrame } from './Sheet'

/** Every recorded value of a saving or debt, newest first, with the change each time. */
export function HistorySheet({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { snapshots } = useData()
  const history = historyOf(snapshots, entry.id)

  return (
    <SheetFrame label={`${entry.name} history`} onClose={onClose}>
      <div className="flex flex-col p-4 pb-2">
        <h2 className={`truncate text-center text-lg font-semibold ${typeColour(entry.type)}`}>
          {entry.name}
        </h2>
        <p className="pb-3 text-center text-sm text-muted">History</p>
        {history.length === 0 ? (
          <p className="py-6 text-center text-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="max-h-[60dvh] overflow-y-auto overscroll-contain rounded-xl bg-surface">
            {history.map((snapshot, i) => {
              const older = history[i + 1]
              const change = older ? snapshot.amount_pence - older.amount_pence : null
              return (
                <li
                  key={snapshot.id}
                  className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 last:border-b-0"
                >
                  <span className="text-text">{formatDay(snapshot.created, true)}</span>
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
                </li>
              )
            })}
          </ul>
        )}
        <button type="button" onClick={onClose} className="py-3 text-base text-muted">
          Close
        </button>
      </div>
    </SheetFrame>
  )
}
