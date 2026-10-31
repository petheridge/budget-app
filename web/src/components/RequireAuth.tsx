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
  const { status, problem, clearProblem, refresh } = useData()

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
          className="rounded-xl bg-action px-6 py-3 font-bold text-white"
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
          className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+4rem)] z-50 mx-auto max-w-[568px] rounded-xl bg-text p-3 text-left text-sm text-white shadow-lg"
        >
          {problem}
        </button>
      )}
    </>
  )
}
