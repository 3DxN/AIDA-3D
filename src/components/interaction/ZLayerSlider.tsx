'use client'

import { useRef, useState, useEffect } from 'react'

interface ZLayerSliderProps {
  currentZ: number
  layersBelow: number
  layersAbove: number
  maxZ: number
  maxTotalLayers: number
  onCurrentZChange: (value: number) => void
  onLayersBelowChange: (value: number) => void
  onLayersAboveChange: (value: number) => void
  onChangeCommitted?: () => void
}

export default function ZLayerSlider({
  currentZ,
  layersBelow,
  layersAbove,
  maxZ,
  maxTotalLayers,
  onCurrentZChange,
  onLayersBelowChange,
  onLayersAboveChange,
  onChangeCommitted
}: ZLayerSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'current' | 'start' | 'end' | null>(null)
  const [hovering, setHovering] = useState<'current' | 'start' | 'end' | null>(null)

  // Temporary state during dragging
  const [tempCurrentZ, setTempCurrentZ] = useState<number | null>(null)
  const [tempLayersBelow, setTempLayersBelow] = useState<number | null>(null)
  const [tempLayersAbove, setTempLayersAbove] = useState<number | null>(null)

  // Calculate positions using temporary values during drag, actual values otherwise
  const activeCurrentZ = tempCurrentZ ?? currentZ
  const activeLayersBelow = tempLayersBelow ?? layersBelow
  const activeLayersAbove = tempLayersAbove ?? layersAbove

  const startZ = Math.max(0, activeCurrentZ - activeLayersBelow)
  const endZ = Math.min(maxZ, activeCurrentZ + activeLayersAbove)

  const getPercentage = (value: number) => (value / maxZ) * 100

  const startPercent = getPercentage(startZ)
  const currentPercent = getPercentage(currentZ)
  const endPercent = getPercentage(endZ)

  const handleMouseDown = (handle: 'current' | 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(handle)
  }

  useEffect(() => {
    if (!dragging || !trackRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const track = trackRef.current
      if (!track) return

      const rect = track.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const percent = x / rect.width
      const zValue = Math.round(percent * maxZ)

      if (dragging === 'current') {
        // Move current Z, update immediately (no temp state needed for visual feedback)
        const newCurrentZ = Math.max(0, Math.min(maxZ, zValue))
        onCurrentZChange(newCurrentZ)
      } else if (dragging === 'start') {
        // Adjust layers below - use temp state for smooth dragging
        const newStartZ = Math.max(0, Math.min(currentZ, zValue))
        const newLayersBelow = currentZ - newStartZ

        // If we would exceed max total layers, reduce layers above
        if (newLayersBelow + layersAbove > maxTotalLayers) {
          const adjustedLayersAbove = maxTotalLayers - newLayersBelow
          setTempLayersAbove(adjustedLayersAbove)
          setTempLayersBelow(newLayersBelow)
        } else {
          setTempLayersBelow(newLayersBelow)
          // Keep layers above at current value if not adjusting
          if (tempLayersAbove !== null) {
            setTempLayersAbove(null)
          }
        }
      } else if (dragging === 'end') {
        // Adjust layers above - use temp state for smooth dragging
        const newEndZ = Math.max(currentZ, Math.min(maxZ, zValue))
        const newLayersAbove = newEndZ - currentZ

        // If we would exceed max total layers, reduce layers below
        if (newLayersAbove + layersBelow > maxTotalLayers) {
          const adjustedLayersBelow = maxTotalLayers - newLayersAbove
          setTempLayersBelow(adjustedLayersBelow)
          setTempLayersAbove(newLayersAbove)
        } else {
          setTempLayersAbove(newLayersAbove)
          // Keep layers below at current value if not adjusting
          if (tempLayersBelow !== null) {
            setTempLayersBelow(null)
          }
        }
      }
    }

    const handleMouseUp = () => {
      // Commit temporary layer values (currentZ is already committed during drag)
      if (tempLayersBelow !== null) {
        onLayersBelowChange(tempLayersBelow)
      }
      if (tempLayersAbove !== null) {
        onLayersAboveChange(tempLayersAbove)
      }

      // Call the committed callback if provided (triggers data fetch)
      if (onChangeCommitted && (tempLayersBelow !== null || tempLayersAbove !== null)) {
        onChangeCommitted()
      }

      // Clear temporary state
      setTempCurrentZ(null)
      setTempLayersBelow(null)
      setTempLayersAbove(null)
      setDragging(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, currentZ, layersBelow, layersAbove, maxZ, maxTotalLayers, onCurrentZChange, onLayersBelowChange, onLayersAboveChange])

  return (
    <div className="w-full px-4 py-6">
      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-600 mb-2">
        <span>Z: {startZ}</span>
        <span className="font-semibold text-red-600">Current: {activeCurrentZ}</span>
        <span>Z: {endZ}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-12 cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        {/* Background track */}
        <div className="absolute top-1/2 w-full h-1 bg-gray-300 -translate-y-1/2 rounded" />

        {/* Active range (bold blue line) */}
        <div
          className="absolute top-1/2 h-2 bg-blue-600 -translate-y-1/2 rounded"
          style={{
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`
          }}
        />

        {/* Start handle (white circle) */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
          style={{ left: `${startPercent}%` }}
          onMouseDown={handleMouseDown('start')}
          onMouseEnter={() => setHovering('start')}
          onMouseLeave={() => setHovering(null)}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white border-2 border-blue-600 shadow-md transition-transform ${
              hovering === 'start' || dragging === 'start' ? 'scale-125' : ''
            }`}
          />
        </div>

        {/* Current Z handle (red vertical line) */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
          style={{ left: `${currentPercent}%` }}
          onMouseDown={handleMouseDown('current')}
          onMouseEnter={() => setHovering('current')}
          onMouseLeave={() => setHovering(null)}
        >
          <div
            className={`w-1 h-12 bg-red-600 shadow-md transition-all ${
              hovering === 'current' || dragging === 'current' ? 'w-1.5 h-14' : ''
            }`}
            style={{ borderRadius: '2px' }}
          />
        </div>

        {/* End handle (white circle) */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
          style={{ left: `${endPercent}%` }}
          onMouseDown={handleMouseDown('end')}
          onMouseEnter={() => setHovering('end')}
          onMouseLeave={() => setHovering(null)}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white border-2 border-blue-600 shadow-md transition-transform ${
              hovering === 'end' || dragging === 'end' ? 'scale-125' : ''
            }`}
          />
        </div>
      </div>

      {/* Info text */}
      <div className="flex justify-center text-xs text-gray-600 mt-2">
        <span>{activeLayersBelow} layers below • {activeLayersAbove} layers above • Total: {activeLayersBelow + activeLayersAbove} / {maxTotalLayers}</span>
      </div>
    </div>
  )
}
