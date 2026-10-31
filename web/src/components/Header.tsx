import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FolderIcon } from './icons'

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
  return (
    <header className="shrink-0 bg-brand pt-[env(safe-area-inset-top)] text-white">
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
    </header>
  )
}

export function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-10 items-center justify-center"
    >
      {children}
    </button>
  )
}
