import { useSyncExternalStore } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { DataProvider, useData } from '../lib/data'
import { pb } from '../lib/pb'

const subscribe = (onChange: () => void) => pb.authStore.onChange(onChange)
const isSignedIn = () => pb.authStore.isValid

export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, isSignedIn)
}

export function RequireAuth() {
  if (!useSignedIn()) return <Navigate to="/login" replace />
  return (
    <DataProvider>
      <Screens />
    </DataProvider>
  )
}

function Screens() {
  const { status, problem, clearProblem, refresh, undoLabel, undoDelete } = useData()

  if (status === 'loading') {
    return <p className="p-8 text-center text-muted">Loading…</p>
  }
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center text-muted">
        <p>Couldn't reach the server.</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl button-fill [--fill:var(--color-action)] px-6 py-3 font-bold"
        >
          Try again
        </button>
      </div>
    )
  }
  return (
    <>
      <Outlet />
      {problem && (
        <button
          type="button"
          onClick={clearProblem}
          className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+4rem)] z-50 mx-auto max-w-[568px] rounded-xl bg-text p-3 text-left text-sm text-surface shadow-lg"
        >
          {problem}
        </button>
      )}
      {undoLabel && !problem && (
        <div
          role="status"
          className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+4rem)] z-50 mx-auto flex max-w-[568px] items-center gap-3 rounded-xl bg-text py-1.5 pr-1.5 pl-4 text-sm text-surface shadow-lg"
        >
          <span className="min-w-0 flex-1 truncate">{undoLabel}</span>
          <button type="button" onClick={undoDelete} className="rounded-lg px-3 py-2 font-bold text-folder">
            Undo
          </button>
        </div>
      )}
    </>
  )
}
