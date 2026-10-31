import type { ReactNode } from 'react'

function Icon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'size-6'}
    >
      {children}
    </svg>
  )
}

const FOLDER_PATH = 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'

export function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? 'size-7 text-folder'}>
      <path d={FOLDER_PATH} fill="currentColor" />
    </svg>
  )
}

export function FolderPlusIcon() {
  return (
    <Icon>
      <path d={FOLDER_PATH} />
      <path d="M12 11v5M9.5 13.5h5" />
    </Icon>
  )
}

export function MenuIcon() {
  return (
    <Icon>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  )
}

export function ChevronIcon() {
  return (
    <Icon className="size-5 shrink-0 text-brand">
      <path d="m9 5 7 7-7 7" />
    </Icon>
  )
}

export function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-6">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}

export function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
      {[9, 15].flatMap((cx) =>
        [6, 12, 18].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />),
      )}
    </svg>
  )
}

export function PencilIcon() {
  return (
    <Icon className="mt-0.5 size-3 shrink-0">
      <path d="M4 20h4L19 9l-4-4L4 16ZM13 7l4 4" />
    </Icon>
  )
}
