'use client'

import React, { useEffect, useRef } from 'react'
import type { VivViewState } from '../../../types/viewer2D/vivViewer'
import type { ROI } from '../../../types/roi'

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

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    // Always clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Need viewState for coordinate transformation
    if (!viewState) return

    // Filter ROIs visible at current Z slice AND selected
    const visibleROIs = rois.filter(r =>
      r.id === selectedId &&
      r.zRange &&
      zSlice >= r.zRange[0] &&
      zSlice <= r.zRange[1]
    )

    if (visibleROIs.length === 0) return

    // Transform world coordinates to screen coordinates
    const { target, zoom } = viewState
    const scale = Math.pow(2, zoom)

    const toScreen = (worldX: number, worldY: number): [number, number] => {
      const screenX = (worldX - target[0]) * scale + containerSize.width / 2
      const screenY = (worldY - target[1]) * scale + containerSize.height / 2
      return [screenX, screenY]
    }

    // Draw each ROI
    visibleROIs.forEach(roi => {
      if (!roi.points || roi.points.length < 3) return

      const isSelected = roi.id === selectedId
      const screenPoints = roi.points.map(p => toScreen(p[0], p[1]))

      // Draw filled polygon
      ctx.beginPath()
      ctx.moveTo(screenPoints[0][0], screenPoints[0][1])
      for (let i = 1; i < screenPoints.length; i++) {
        ctx.lineTo(screenPoints[i][0], screenPoints[i][1])
      }
      ctx.closePath()
      ctx.fillStyle = hexToRgba(roi.color, isSelected ? 0.15 : 0.08)
      ctx.fill()

      // Draw outline
      ctx.strokeStyle = hexToRgba(roi.color, isSelected ? 1 : 0.6)
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.stroke()
    })

  }, [viewState, containerSize, rois, selectedId, zSlice])

  if (rois.length === 0) return null

  return (
    <canvas
      ref={canvasRef}
      width={containerSize.width}
      height={containerSize.height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 9
      }}
    />
  )
}
