import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useConnected } from '../lib/data'
import { FolderIcon } from './icons'
import { RenameInput } from './RenameInput'

export interface Back {
  to: string
  label: string
  isFolder: boolean
}

export function Header({
  title,
  back,
  actions,
}: {
  title: ReactNode
  back?: Back
  actions?: ReactNode
}) {
  const connected = useConnected()
  return (
    <header className="shrink-0 bg-bar pt-[env(safe-area-inset-top)] text-white">
      <div className="grid h-14 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-1 px-2">
        <div className="min-w-0">
          {back && (
            <Link to={back.to} className="flex min-h-11 items-center gap-1 pl-1">
              <span className="text-2xl leading-none">‹</span>
              {back.isFolder && <FolderIcon className="size-5 shrink-0 text-white" />}
              <span className="truncate">{back.label}</span>
            </Link>
          )}
        </div>
        <h1 className="flex min-w-0 items-center justify-center gap-1.5 text-lg font-semibold">
          {title}
        </h1>
        <div className="flex justify-end">{actions}</div>
      </div>
      {!connected && (
        <p role="status" className="bg-black/25 px-3 py-1 text-center text-xs font-semibold">
          Not connected. Changes won’t be saved.
        </p>
      )}
    </header>
  )
}

export function HeaderButton({
  label,
  onClick,
  opensMenu = false,
  children,
}: {
  label: string
  /** Given the button, for a menu to open from. */
  onClick: (button: HTMLElement) => void
  opensMenu?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup={opensMenu ? 'menu' : undefined}
      onClick={(event) => onClick(event.currentTarget)}
      className="flex size-10 items-center justify-center"
    >
      {children}
    </button>
  )
}

/** A screen's title, which becomes a text box while it's being renamed. */
export function EditableTitle({
  name,
  renaming,
  onDone,
}: {
  name: string
  renaming: boolean
  onDone: (name: string | null) => void
}) {
  if (!renaming) return <span className="truncate">{name}</span>
  return (
    <RenameInput
      value={name}
      label={`Name for ${name}`}
      onDone={onDone}
      className="bg-white/15 text-center font-semibold text-white ring-2 ring-white/70 ring-inset selection:bg-white/35 selection:text-white"
    />
  )
}
