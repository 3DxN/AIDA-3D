'use client'

import React, { useEffect, useRef } from 'react'
import { useROI } from '../../../../lib/contexts/ROIContext'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import type { VivViewState } from '../../../../types/viewer2D/vivViewer'

interface ROIOverlayProps {
    viewState: VivViewState | null
    containerSize: { width: number; height: number }
}

export const ROIOverlay: React.FC<ROIOverlayProps> = ({ viewState, containerSize }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const {
        rois,
        roisVisible,
        drawingState,
        selectedROIIds
    } = useROI()

    const { navigationState } = useViewer2DData()

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')

        if (!ctx || !canvas || !viewState) {
            return
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Don't render if ROIs not visible and not currently drawing
        if (!roisVisible && !drawingState.isDrawing) {
            return
        }

        const { target, zoom } = viewState
        const scale = Math.pow(2, zoom)
        const currentZ = navigationState?.zSlice ?? 0

        // Helper: Convert world coordinates to screen coordinates
        const worldToScreen = (x: number, y: number): [number, number] => {
            const screenX = (x - target[0]) * scale + containerSize.width / 2
            const screenY = (y - target[1]) * scale + containerSize.height / 2
            return [screenX, screenY]
        }

        // Draw completed ROIs (only those on current Z-slice or if ROIs are visible)
        if (roisVisible) {
            rois.forEach(roi => {
                // Only show ROIs on the current z-slice
                if (roi.zSlice !== currentZ) return
                if (roi.vertices.length < 3) return

                const isSelected = selectedROIIds.includes(roi.id)

                // Draw polygon fill
                ctx.beginPath()
                const [startX, startY] = worldToScreen(roi.vertices[0].x, roi.vertices[0].y)
                ctx.moveTo(startX, startY)

                for (let i = 1; i < roi.vertices.length; i++) {
                    const [x, y] = worldToScreen(roi.vertices[i].x, roi.vertices[i].y)
                    ctx.lineTo(x, y)
                }
                ctx.closePath()

                // Fill with semi-transparent color
                ctx.fillStyle = isSelected
                    ? 'rgba(255, 200, 0, 0.3)'  // Yellow for selected
                    : 'rgba(0, 200, 255, 0.2)'  // Cyan for normal
                ctx.fill()

                // Stroke outline
                ctx.strokeStyle = isSelected ? '#ffcc00' : '#00ccff'
                ctx.lineWidth = isSelected ? 3 : 2
                ctx.stroke()

                // Draw label at centroid
                const centroidX = roi.vertices.reduce((sum, v) => sum + v.x, 0) / roi.vertices.length
                const centroidY = roi.vertices.reduce((sum, v) => sum + v.y, 0) / roi.vertices.length
                const [labelX, labelY] = worldToScreen(centroidX, centroidY)

                ctx.font = '12px sans-serif'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                // Draw text with outline for readability
                ctx.strokeStyle = '#000000'
                ctx.lineWidth = 3
                ctx.strokeText(roi.label, labelX, labelY)
                ctx.fillStyle = '#ffffff'
                ctx.fillText(roi.label, labelX, labelY)
            })
        }

        // Draw current drawing in progress
        if (drawingState.isDrawing && drawingState.currentVertices.length > 0) {
            ctx.beginPath()
            const [startX, startY] = worldToScreen(
                drawingState.currentVertices[0].x,
                drawingState.currentVertices[0].y
            )
            ctx.moveTo(startX, startY)

            // Draw lines between vertices
            for (let i = 1; i < drawingState.currentVertices.length; i++) {
                const [x, y] = worldToScreen(
                    drawingState.currentVertices[i].x,
                    drawingState.currentVertices[i].y
                )
                ctx.lineTo(x, y)
            }

            // Draw preview line to cursor
            if (drawingState.previewVertex) {
                const [previewX, previewY] = worldToScreen(
                    drawingState.previewVertex.x,
                    drawingState.previewVertex.y
                )
                ctx.lineTo(previewX, previewY)
            }

            // Dashed line style for in-progress drawing
            ctx.setLineDash([5, 5])
            ctx.strokeStyle = '#ff6600'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.setLineDash([])

            // Draw vertices as small circles
            drawingState.currentVertices.forEach((vertex, index) => {
                const [vx, vy] = worldToScreen(vertex.x, vertex.y)
                ctx.beginPath()
                // First vertex is larger (close target)
                ctx.arc(vx, vy, index === 0 ? 8 : 5, 0, Math.PI * 2)
                ctx.fillStyle = index === 0 ? '#00ff00' : '#ff6600'
                ctx.fill()
                ctx.strokeStyle = '#ffffff'
                ctx.lineWidth = 2
                ctx.stroke()
            })

            // Draw vertex count indicator
            ctx.font = '11px sans-serif'
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillStyle = '#ff6600'
            const vertexCountText = `Vertices: ${drawingState.currentVertices.length}`
            ctx.fillText(vertexCountText, 10, 10)
        }

    }, [
        rois,
        roisVisible,
        drawingState,
        selectedROIIds,
        viewState,
        containerSize,
        navigationState?.zSlice
    ])

    // Don't render canvas at all if not needed
    if (!roisVisible && !drawingState.isDrawing) {
        return null
    }

    return (
        <canvas
            ref={canvasRef}
            width={containerSize.width}
            height={containerSize.height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none', // Allow clicks to pass through to the viewer
                zIndex: 15 // Above CellposeOverlay (z-index 10)
            }}
        />
    )
}
