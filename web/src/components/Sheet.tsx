import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useData } from '../lib/data'
import type { BudgetKind } from '../lib/pb'
import { folderPath } from '../lib/selectors'

export function SheetFrame({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative max-h-full w-full max-w-[600px] overflow-y-auto overscroll-contain rounded-t-2xl bg-bg pb-[env(safe-area-inset-bottom)]"
      >
        {children}
      </div>
    </div>
  )
}

export interface Action {
  label: string
  onClick: () => void
  danger?: boolean
}

/** What a ⋮ opens: a short list of choices. */
export function ActionSheet({
  title,
  actions,
  onClose,
}: {
  title: string
  actions: Action[]
  onClose: () => void
}) {
  return (
    <SheetFrame label={title} onClose={onClose}>
      <div className="flex flex-col gap-2 p-4">
        <p className="truncate pb-1 text-center text-sm text-muted">{title}</p>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`rounded-xl bg-surface py-3.5 text-base font-semibold ${action.danger ? 'text-expense' : 'text-text'}`}
          >
            {action.label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="py-3 text-base text-muted">
          Cancel
        </button>
      </div>
    </SheetFrame>
  )
}

export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <SheetFrame label={title} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-center text-lg font-semibold">{title}</h2>
        <p className="pb-1 text-center text-sm text-muted">{message}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-expense py-3.5 font-bold text-white"
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={onClose} className="py-3 text-base text-muted">
          Cancel
        </button>
      </div>
    </SheetFrame>
  )
}

export function NoticeSheet({
  title,
  message,
  onClose,
}: {
  title: string
  message: string
  onClose: () => void
}) {
  return (
    <SheetFrame label={title} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-center text-lg font-semibold">{title}</h2>
        <p className="pb-1 text-center text-sm text-muted">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-action py-3.5 font-bold text-white"
        >
          OK
        </button>
      </div>
    </SheetFrame>
  )
}

/**
 * Save and Cancel sit at the top so the iPhone keyboard can't cover them.
 * `onSave` may throw; it's shown here and the sheet stays open.
 */
export function FormSheet({
  title,
  onSave,
  onClose,
  error,
  children,
}: {
  title: string
  onSave: () => Promise<void>
  onClose: () => void
  error?: string
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      await onSave()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetFrame label={title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-black/10 bg-surface px-4 py-3">
          <button type="button" onClick={onClose} className="justify-self-start text-muted">
            Cancel
          </button>
          <h2 className="truncate font-semibold">{title}</h2>
          <button type="submit" disabled={busy} className="justify-self-end font-bold text-action">
            Save
          </button>
        </div>
        <div className="flex flex-col gap-4 p-4 pb-6">
          {children}
          {error && <p className="text-sm text-expense">{error}</p>}
          {failed && <p className="text-sm text-expense">Couldn't save. Please try again.</p>}
        </div>
      </form>
    </SheetFrame>
  )
}

export const inputClass =
  'mt-1 w-full rounded-xl border border-black/10 bg-surface px-3 py-3 text-base text-text'

export function FolderSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (folderId: string) => void
}) {
  const { folders } = useData()
  const options = folders
    .map((folder) => ({ id: folder.id, path: folderPath(folders, folder) }))
    .sort((a, b) => a.path.localeCompare(b.path))

  return (
    <label className="text-sm text-muted">
      {label}
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Budgets (top level)</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.path}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Name, plus optionally which folder to put it in and, for a new budget, its kind. */
export function NameSheet({
  title,
  initialName = '',
  folderLabel,
  initialFolder = '',
  chooseKind = false,
  onSave,
  onClose,
}: {
  title: string
  initialName?: string
  folderLabel?: string
  initialFolder?: string
  chooseKind?: boolean
  onSave: (name: string, folder: string, kind: BudgetKind) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [folder, setFolder] = useState(initialFolder)
  const [kind, setKind] = useState<BudgetKind>('budget')
  const [error, setError] = useState('')

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter a name.')
      return
    }
    setError('')
    await onSave(trimmed, folder, kind)
    onClose()
  }

  return (
    <FormSheet title={title} onSave={save} onClose={onClose} error={error}>
      {chooseKind && <KindChoice value={kind} onChange={setKind} />}
      <label className="text-sm text-muted">
        Name
        <input
          className={inputClass}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {folderLabel && <FolderSelect label={folderLabel} value={folder} onChange={setFolder} />}
    </FormSheet>
  )
}

const kinds: { value: BudgetKind; label: string; hint: string }[] = [
  { value: 'budget', label: 'Budget', hint: 'Income and outgoings' },
  { value: 'tracker', label: 'Savings & debts', hint: 'Values tracked over time' },
]

/** Two side-by-side options: an income/expense budget, or savings & debts. */
function KindChoice({ value, onChange }: { value: BudgetKind; onChange: (kind: BudgetKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-2">
      {kinds.map((kind) => {
        const selected = kind.value === value
        return (
          <button
            key={kind.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(kind.value)}
            className={`rounded-xl border-2 bg-surface px-3 py-2.5 text-left ${selected ? 'border-brand' : 'border-transparent'}`}
          >
            <span className={`block font-semibold ${selected ? 'text-brand' : 'text-text'}`}>
              {kind.label}
            </span>
            <span className="block text-xs text-muted">{kind.hint}</span>
          </button>
        )
      })}
    </div>
  )
}
