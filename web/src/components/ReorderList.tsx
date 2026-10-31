import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { GripIcon } from './icons'

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function ReorderList<T>({
  items,
  getId,
  onReorder,
  className,
  children,
}: {
  items: T[]
  getId: (item: T) => string
  onReorder: (items: T[]) => void
  className?: string
  children: (item: T, handle: ReactNode) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = items.map(getId)
    onReorder(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <Row key={getId(item)} id={getId(item)} render={(handle) => children(item, handle)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Row({ id, render }: { id: string; render: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label="Drag to reorder"
      className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-muted/60"
      {...attributes}
      {...listeners}
    >
      <GripIcon />
    </button>
  )

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? 'relative z-10 opacity-90' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {render(handle)}
    </li>
  )
}
