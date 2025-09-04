import { useEffect, useCallback, useRef } from 'react'

import type { ViewerSize } from '../../types/viewer2D/dimensions'


/**
 * useResizeObserver
 *
 * React hook to observe an element's rendered size using ResizeObserver.
 * Emits width/height in CSS pixels and updates whenever layout/styles change.
 *
 * Example usage in a viewer component:
 *
 *   import { useRef, useCallback } from 'react'
 *   import { useViewer2DData } from '@/lib/contexts/Viewer2DDataContext'
 *   import { useResizeObserver } from '@/lib/hooks/useResizeObserver'
 *
 *   function Viewer2D() {
 *     const { setViewerSize } = useViewer2DData()
 *     const containerRef = useRef<HTMLDivElement>(null)
 *     const onSize = useCallback(({ width, height }) => setViewerSize({ width, height }), [setViewerSize])
 *     useResizeObserver(containerRef, onSize)
 *     return (<div ref={containerRef} className="relative w-full h-full">...</div>)
 *   }
 */
export function useResizeObserver<T extends HTMLElement>(
  ref: React.RefObject<T>,
  onSize: (size: ViewerSize) => void
) {
  // Use a ref to store the latest callback to avoid re-creating the effect
  const onSizeRef = useRef(onSize)
  onSizeRef.current = onSize

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const notify = () => {
      const rect = el.getBoundingClientRect()
      onSizeRef.current({ width: Math.round(rect.width), height: Math.round(rect.height) })
    }

    const ro = new ResizeObserver(() => notify())
    ro.observe(el)
    notify()

    return () => ro.disconnect()
  }, [ref]) // Remove onSize from dependencies
}
