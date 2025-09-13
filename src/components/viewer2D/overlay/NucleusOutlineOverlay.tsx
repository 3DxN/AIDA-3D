import React, { useMemo } from 'react'
import * as zarrita from 'zarrita'
import { PolygonLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'

import { useNucleusSelection } from '../../../lib/contexts/NucleusSelectionContext'
import { useViewer2DData } from '../../../lib/contexts/Viewer2DDataContext'

interface NucleusOutlineData {
    contour: number[][]
    labelValue: number
    isSelected: boolean
}

/**
 * Extract nucleus outlines from cellpose data for the current Z slice
 */
function extractNucleusOutlines(
    cellposeData: zarrita.Chunk<zarrita.DataType>,
    selectedIndices: number[],
    currentZSlice: number
): NucleusOutlineData[] {
    if (!cellposeData || !cellposeData.data) return []

    const data = cellposeData.data as any
    const shape = cellposeData.shape

    // Handle different dimensional structures
    let sliceData: any
    let width: number
    let height: number

    if (shape.length === 3) {
        // 3D data: [z, y, x]
        const zIndex = Math.min(currentZSlice, shape[0] - 1)
        sliceData = data.slice(zIndex * shape[1] * shape[2], (zIndex + 1) * shape[1] * shape[2])
        height = shape[1]
        width = shape[2]
    } else if (shape.length === 2) {
        // 2D data: [y, x]
        sliceData = data
        height = shape[0]
        width = shape[1]
    } else {
        console.warn('Unexpected cellpose data shape:', shape)
        return []
    }

    // Find unique label values in the current slice
    const labelSet = new Set<number>()
    for (let i = 0; i < sliceData.length; i++) {
        const value = sliceData[i]
        if (value > 0) {
            labelSet.add(value)
        }
    }

    const outlines: NucleusOutlineData[] = []

    // For each unique label, find its outline
    labelSet.forEach(labelValue => {
        const isSelected = selectedIndices.includes(labelValue)

        // Simple contour extraction using marching squares-like approach
        const contourPoints: number[][] = []

        // Find boundary pixels
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const currentIndex = y * width + x
                const current = sliceData[currentIndex]

                if (current === labelValue) {
                    // Check if this pixel is on the boundary
                    const neighbors = [
                        sliceData[(y - 1) * width + x] || 0, // top
                        sliceData[y * width + (x + 1)] || 0, // right  
                        sliceData[(y + 1) * width + x] || 0, // bottom
                        sliceData[y * width + (x - 1)] || 0, // left
                    ]

                    // If any neighbor is different (including 0), this is a boundary pixel
                    if (neighbors.some(neighbor => neighbor !== labelValue)) {
                        contourPoints.push([x, y])
                    }
                }
            }
        }

        if (contourPoints.length > 0) {
            // For now, create a simple convex hull or ordered boundary
            // This is a simplified version - for production, you'd want proper contour tracing
            const orderedContour = orderContourPoints(contourPoints)

            if (orderedContour.length >= 3) {
                // Close the polygon
                orderedContour.push(orderedContour[0])

                outlines.push({
                    contour: orderedContour,
                    labelValue,
                    isSelected
                })
            }
        }
    })

    return outlines
}

/**
 * Simple ordering of contour points (simplified convex hull)
 */
function orderContourPoints(points: number[][]): number[][] {
    if (points.length <= 3) return points

    // Find centroid
    const centroid = points.reduce(
        (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
        [0, 0]
    ).map(sum => sum / points.length)

    // Sort points by angle from centroid
    return points.sort((a, b) => {
        const angleA = Math.atan2(a[1] - centroid[1], a[0] - centroid[0])
        const angleB = Math.atan2(b[1] - centroid[1], b[0] - centroid[0])
        return angleA - angleB
    })
}

export interface NucleusOutlineOverlayProps {
    viewportId: string
    opacity?: number
    lineWidth?: number
    selectedColor?: [number, number, number, number]
}

export default function NucleusOutlineOverlay({
    viewportId,
    opacity = 0.8,
    lineWidth = 2,
    selectedColor = [255, 255, 0, 255] // Yellow for selected nuclei
}: NucleusOutlineOverlayProps): Layer[] {

    const { selectedNucleiIndices } = useNucleusSelection()
    const { frameBoundCellposeData, currentZSlice } = useViewer2DData()

    const nucleusOutlines = useMemo(() => {
        if (!frameBoundCellposeData) {
            return []
        }

        return extractNucleusOutlines(
            frameBoundCellposeData,
            selectedNucleiIndices,
            currentZSlice
        )
    }, [frameBoundCellposeData, selectedNucleiIndices, currentZSlice])

    const polygonLayer = useMemo(() => {
        if (nucleusOutlines.length === 0) return null

        return new PolygonLayer({
            id: `nucleus-outlines-${viewportId}`,
            data: nucleusOutlines,
            getPolygon: (d: NucleusOutlineData) => d.contour,
            getLineColor: (d: NucleusOutlineData) => d.isSelected ? selectedColor : [255, 255, 255, 178],
            getFillColor: (d: NucleusOutlineData) => d.isSelected ? [255, 255, 0, 100] : [255, 255, 255, 50],
            getLineWidth: (d: NucleusOutlineData) => d.isSelected ? lineWidth * 2 : lineWidth,
            lineWidthUnits: 'pixels',
            lineWidthScale: 1,
            lineWidthMinPixels: 1,
            lineWidthMaxPixels: 10,
            filled: true,
            stroked: true,
            pickable: false, // Don't interfere with other interactions
            coordinateSystem: 0, // Use the same coordinate system as the image
            opacity
        })
    }, [nucleusOutlines, viewportId, selectedColor, lineWidth, opacity])

    return polygonLayer ? [polygonLayer] : []
}

/**
 * Hook to get nucleus outline layers for integration with VivViewer
 */
export function useNucleusOutlineLayers(
    viewportId: string,
    options: Partial<NucleusOutlineOverlayProps> = {}
): Layer[] {
    return useMemo(() => {
        const component = NucleusOutlineOverlay({
            viewportId,
            ...options
        })
        return component || []
    }, [viewportId, options])
}