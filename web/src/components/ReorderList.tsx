import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { useEffect, useState, type ReactNode } from 'react'

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * Press and hold anywhere on a row to pick it up, then drag to reorder, as in
 * Fudget. A tap still reaches the row's links and buttons, and a quick swipe
 * still scrolls the list: moving before the hold completes cancels the drag.
 *
 * From a keyboard: Tab to a row, Space to pick it up, the arrow keys to move it,
 * Space to put it down (Escape puts it back).
 */
const HOLD = { delay: 350, tolerance: 8 }

/** Rows making way for the one being dragged move smoothly from place to place. */
const MAKE_WAY = { duration: 200, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }

/**
 * Rows arrive one after another when their screen opens (`.stagger` in index.css),
 * but not after that: a row added later just appears where it belongs.
 */
function useArriving() {
  const [arriving, setArriving] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setArriving(false), 600)
    return () => window.clearTimeout(timer)
  }, [])
  return arriving
}

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
  const arriving = useArriving()
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: HOLD }),
    useSensor(MouseSensor, { activationConstraint: HOLD }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
        <ul className={`${className ?? ''} ${arriving ? 'stagger' : ''}`}>
          {items.map((item, i) => (
            <Row key={getId(item)} id={getId(item)} index={i}>
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
 * the finger, opening a budget or an amount's keypad. Only the click that comes
 * straight out of the drop is swallowed: a new touch or click clears it, since a
 * touch drag often produces no click at all.
 */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    stop()
  }
  const stop = () => {
    window.removeEventListener('click', swallow, { capture: true })
    window.removeEventListener('pointerdown', stop, { capture: true })
  }
  window.addEventListener('click', swallow, { capture: true })
  window.addEventListener('pointerdown', stop, { capture: true })
  window.setTimeout(stop, 400)
}

function Row({ id, index, children }: { id: string; index: number; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: MAKE_WAY,
  })

  return (
    <li
      // Also the activator, so Space or Return only picks a row up when the row itself has
      // focus, not when typing in a name box or pressing a button inside it.
      ref={(node) => {
        setNodeRef(node)
        setActivatorNodeRef(node)
      }}
      {...attributes}
      // Still a list item to a screen reader, not the button dnd-kit would make it:
      // it holds buttons and links of its own.
      role={undefined}
      {...listeners}
      // No text selection or iOS link preview on a long press, which is how a row is picked up.
      className={`touch-manipulation outline-none select-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset [-webkit-touch-callout:none] [&_*]:[-webkit-touch-callout:none] ${isDragging ? 'relative z-10 scale-[1.02] opacity-95 shadow-[0_4px_12px_rgba(0,0,0,0.18)]' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition, ['--i' as string]: index }}
    >
      {children}
    </li>
  )
}
