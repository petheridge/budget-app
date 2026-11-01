import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * Press and hold anywhere on a row to pick it up, then drag to reorder, as in
 * Fudget. A tap still reaches the row's links and buttons, and a quick swipe
 * still scrolls the list: moving before the hold completes cancels the drag.
 */
const HOLD = { delay: 350, tolerance: 8 }

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
  children: (item: T) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: HOLD }),
    useSensor(MouseSensor, { activationConstraint: HOLD }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    swallowNextClick()
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
      onDragCancel={swallowNextClick}
    >
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <Row key={getId(item)} id={getId(item)}>
              {children(item)}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

/**
 * Letting go after a drag would otherwise count as a tap on whatever is under
 * the finger, opening a budget or an amount's keypad.
 */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400)
}

function Row({ id, children }: { id: string; children: ReactNode }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      // No text selection or iOS link preview on a long press, which is how a row is picked up.
      className={`touch-manipulation select-none [-webkit-touch-callout:none] [&_*]:[-webkit-touch-callout:none] ${isDragging ? 'relative z-10 scale-[1.02] opacity-95 shadow-[0_4px_12px_rgba(0,0,0,0.18)]' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children}
    </li>
  )
}
