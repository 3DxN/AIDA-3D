'use client'

import React, { useEffect, useRef } from 'react'
import type { VivViewState } from '../../../types/viewer2D/vivViewer'

interface ROIDrawingOverlayProps {
  viewState: VivViewState | null
  containerSize: { width: number; height: number }
  drawingPoints: [number, number][]
  cursorPosition: [number, number] | null
  isDrawing: boolean
}

export const ROIDrawingOverlay: React.FC<ROIDrawingOverlayProps> = ({
  viewState,
  containerSize,
  drawingPoints,
  cursorPosition,
  isDrawing
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

    // Don't draw if not in drawing mode or no points
    if (!isDrawing || drawingPoints.length === 0) return

    // Transform world coordinates to screen coordinates
    const { target, zoom } = viewState
    const scale = Math.pow(2, zoom)

    const toScreen = (worldX: number, worldY: number): [number, number] => {
      const screenX = (worldX - target[0]) * scale + containerSize.width / 2
      const screenY = (worldY - target[1]) * scale + containerSize.height / 2
      return [screenX, screenY]
    }

    // Draw lines between confirmed points
    if (drawingPoints.length > 1) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.9)' // teal
      ctx.lineWidth = 2
      const [startX, startY] = toScreen(drawingPoints[0][0], drawingPoints[0][1])
      ctx.moveTo(startX, startY)
      for (let i = 1; i < drawingPoints.length; i++) {
        const [x, y] = toScreen(drawingPoints[i][0], drawingPoints[i][1])
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Draw rubber-band line from last point to cursor
    if (cursorPosition) {
      const lastPoint = drawingPoints[drawingPoints.length - 1]
      const [lastX, lastY] = toScreen(lastPoint[0], lastPoint[1])
      const [cursorX, cursorY] = toScreen(cursorPosition[0], cursorPosition[1])

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.7)'
      ctx.lineWidth = 2
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(cursorX, cursorY)
      ctx.stroke()
    }

    // Draw vertices as circles with high visibility
    drawingPoints.forEach((point, index) => {
      const [screenX, screenY] = toScreen(point[0], point[1])
      const isFirst = index === 0
      const radius = isFirst ? 10 : 7

      // Glow effect
      ctx.beginPath()
      ctx.arc(screenX, screenY, radius + 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fill()

      // Fill
      ctx.beginPath()
      ctx.arc(screenX, screenY, radius, 0, Math.PI * 2)
      ctx.fillStyle = isFirst ? '#14b8a6' : '#fff'
      ctx.fill()

      // Stroke
      ctx.strokeStyle = '#14b8a6'
      ctx.lineWidth = 2
      ctx.stroke()
    })

  }, [viewState, containerSize, drawingPoints, cursorPosition, isDrawing])

  if (!isDrawing) return null

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
        zIndex: 10
      }}
    />
  )
}
