import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { useSignedIn } from '../components/RequireAuth'
import { pb } from '../lib/pb'

export function Login() {
  const signedIn = useSignedIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (signedIn) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await pb.collection('users').authWithPassword(email, password)
    } catch {
      setError('Could not sign in. Check your email and password.')
      setBusy(false)
    }
  }

  const field = 'mt-1 w-full rounded-xl border border-black/10 bg-surface px-3 py-3 text-base'

  return (
    <div className="flex h-full flex-col">
      <Header title="Tally" />
      <form onSubmit={submit} className="flex flex-col gap-4 p-4">
        <label className="text-sm text-muted">
          Email
          <input
            className={`${field} text-text`}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-sm text-muted">
          Password
          <input
            className={`${field} text-text`}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-expense">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-action py-3 font-bold text-white disabled:opacity-60"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
