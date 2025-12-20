'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { VivViewState } from '../../../types/viewer2D/vivViewer'
import type { ROI } from '../../../types/roi'
import { useROI } from '../../../lib/contexts/ROIContext'

interface ROIOverlayProps {
  viewState: VivViewState | null
  containerSize: { width: number; height: number }
  rois: ROI[]
  selectedId: string | null
  zSlice: number
}

function hexToRgba(hex: string, alpha: number): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (r) {
    return `rgba(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}, ${alpha})`
  }
  return `rgba(128, 128, 128, ${alpha})`
}

export const ROIOverlay: React.FC<ROIOverlayProps> = ({
  viewState,
  containerSize,
  rois,
  selectedId,
  zSlice
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { isReshaping, updateROIPoints, cancelReshaping } = useROI()
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null)

  // Coordinate transformation helpers
  const getTransforms = useCallback(() => {
    if (!viewState) return null
    const { target, zoom } = viewState
    const scale = Math.pow(2, zoom)
    
    const toScreen = (worldX: number, worldY: number): [number, number] => {
      const screenX = (worldX - target[0]) * scale + containerSize.width / 2
      const screenY = (worldY - target[1]) * scale + containerSize.height / 2
      return [screenX, screenY]
    }

    const toWorld = (screenX: number, screenY: number): [number, number] => {
      const worldX = (screenX - containerSize.width / 2) / scale + target[0]
      const worldY = (screenY - containerSize.height / 2) / scale + target[1]
      return [worldX, worldY]
    }

    return { toScreen, toWorld, scale }
  }, [viewState, containerSize])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!viewState) return

    const transforms = getTransforms()
    if (!transforms) return
    const { toScreen } = transforms

    const visibleROIs = rois.filter(r =>
      r.id === selectedId &&
      r.zRange &&
      zSlice >= r.zRange[0] &&
      zSlice <= r.zRange[1]
    )

    visibleROIs.forEach(roi => {
      if (!roi.points || roi.points.length < 3) return

      const isSelected = roi.id === selectedId
      const screenPoints = roi.points.map(p => toScreen(p[0], p[1]))

      ctx.beginPath()
      ctx.moveTo(screenPoints[0][0], screenPoints[0][1])
      for (let i = 1; i < screenPoints.length; i++) {
        ctx.lineTo(screenPoints[i][0], screenPoints[i][1])
      }
      ctx.closePath()
      ctx.fillStyle = hexToRgba(roi.color, isSelected ? 0.15 : 0.08)
      ctx.fill()

      ctx.strokeStyle = hexToRgba(roi.color, isSelected ? 1 : 0.6)
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.stroke()

      // Draw interactive handles if in reshaping mode
      if (isReshaping && isSelected) {
        screenPoints.forEach((p, idx) => {
          ctx.beginPath()
          ctx.arc(p[0], p[1], 6, 0, Math.PI * 2)
          ctx.fillStyle = draggingPointIndex === idx ? '#fff' : roi.color
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
        })
      }
    })

  }, [viewState, containerSize, rois, selectedId, zSlice, isReshaping, draggingPointIndex, getTransforms])

  // Mouse handlers for reshaping
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isReshaping || !selectedId) return
    const roi = rois.find(r => r.id === selectedId)
    if (!roi) return

    const transforms = getTransforms()
    if (!transforms) return
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Find if we clicked near a handle (within 10 pixels)
    const pointIdx = roi.points.findIndex(p => {
      const sp = transforms.toScreen(p[0], p[1])
      const dist = Math.sqrt((sp[0] - mouseX) ** 2 + (sp[1] - mouseY) ** 2)
      return dist < 10
    })

    if (pointIdx !== -1) {
      setDraggingPointIndex(pointIdx)
      e.stopPropagation()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingPointIndex === null || !selectedId) return
    const roi = rois.find(r => r.id === selectedId)
    if (!roi) return

    const transforms = getTransforms()
    if (!transforms) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const worldPos = transforms.toWorld(e.clientX - rect.left, e.clientY - rect.top)

    const newPoints = [...roi.points]
    newPoints[draggingPointIndex] = worldPos
    updateROIPoints(selectedId, newPoints)
  }

  const handleMouseUp = () => {
    setDraggingPointIndex(null)
  }

  if (rois.length === 0) return null

  return (
    <canvas
      ref={canvasRef}
      width={containerSize.width}
      height={containerSize.height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: isReshaping ? 'auto' : 'none',
        zIndex: 9,
        cursor: isReshaping ? 'crosshair' : 'default'
      }}
    />
  )
}
