'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ROI, ROIDrawingState, ROIBoundingBox, ROIVertex } from '../../types/roi'

interface ROIContextType {
    // ROI Collection
    rois: ROI[]
    addROI: (roi: Omit<ROI, 'id' | 'createdAt'>) => string // Returns new ID
    removeROIs: (ids: string[]) => void
    clearAllROIs: () => void

    // Selection (for deletion)
    selectedROIIds: string[]
    setSelectedROIIds: (ids: string[]) => void
    toggleROISelection: (id: string) => void
    clearROISelection: () => void

    // Visibility
    roisVisible: boolean
    setROIsVisible: (visible: boolean) => void

    // Drawing State
    drawingState: ROIDrawingState
    startDrawing: () => void
    addVertex: (vertex: ROIVertex) => void
    updatePreviewVertex: (vertex: ROIVertex | null) => void
    finishDrawing: (label: string, zSlice: number) => ROI | null
    cancelDrawing: () => void

    // Navigation Helpers
    getROIBoundingBox: (roi: ROI) => ROIBoundingBox
}

const ROIContext = createContext<ROIContextType | null>(null)

export function useROI(): ROIContextType {
    const context = useContext(ROIContext)
    if (!context) {
        throw new Error('useROI must be used within an ROIProvider')
    }
    return context
}

interface ROIProviderProps {
    children: React.ReactNode
}

export function ROIProvider({ children }: ROIProviderProps) {
    // ROI collection state
    const [rois, setROIs] = useState<ROI[]>([])
    const [selectedROIIds, setSelectedROIIds] = useState<string[]>([])
    const [roisVisible, setROIsVisible] = useState(true)

    // Drawing state
    const [drawingState, setDrawingState] = useState<ROIDrawingState>({
        isDrawing: false,
        currentVertices: [],
        previewVertex: null
    })

    // Generate unique ID
    const generateId = useCallback(() => {
        return `roi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, [])

    // Add ROI
    const addROI = useCallback((roiData: Omit<ROI, 'id' | 'createdAt'>): string => {
        const id = generateId()
        const newROI: ROI = {
            ...roiData,
            id,
            createdAt: Date.now()
        }
        setROIs(prev => [...prev, newROI])
        return id
    }, [generateId])

    // Remove ROIs
    const removeROIs = useCallback((ids: string[]) => {
        setROIs(prev => prev.filter(roi => !ids.includes(roi.id)))
        setSelectedROIIds(prev => prev.filter(id => !ids.includes(id)))
    }, [])

    // Clear all ROIs
    const clearAllROIs = useCallback(() => {
        setROIs([])
        setSelectedROIIds([])
    }, [])

    // Toggle selection
    const toggleROISelection = useCallback((id: string) => {
        setSelectedROIIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(i => i !== id)
            }
            return [...prev, id]
        })
    }, [])

    // Clear selection
    const clearROISelection = useCallback(() => {
        setSelectedROIIds([])
    }, [])

    // Drawing: Start
    const startDrawing = useCallback(() => {
        setDrawingState({
            isDrawing: true,
            currentVertices: [],
            previewVertex: null
        })
    }, [])

    // Drawing: Add vertex
    const addVertex = useCallback((vertex: ROIVertex) => {
        setDrawingState(prev => ({
            ...prev,
            currentVertices: [...prev.currentVertices, vertex]
        }))
    }, [])

    // Drawing: Update preview
    const updatePreviewVertex = useCallback((vertex: ROIVertex | null) => {
        setDrawingState(prev => ({
            ...prev,
            previewVertex: vertex
        }))
    }, [])

    // Drawing: Finish
    const finishDrawing = useCallback((label: string, zSlice: number): ROI | null => {
        if (drawingState.currentVertices.length < 3) {
            // Not enough vertices for a polygon
            setDrawingState({
                isDrawing: false,
                currentVertices: [],
                previewVertex: null
            })
            return null
        }

        const id = generateId()
        const newROI: ROI = {
            id,
            label,
            vertices: [...drawingState.currentVertices],
            zSlice,
            createdAt: Date.now()
        }

        setROIs(prev => [...prev, newROI])
        setDrawingState({
            isDrawing: false,
            currentVertices: [],
            previewVertex: null
        })

        return newROI
    }, [drawingState.currentVertices, generateId])

    // Drawing: Cancel
    const cancelDrawing = useCallback(() => {
        setDrawingState({
            isDrawing: false,
            currentVertices: [],
            previewVertex: null
        })
    }, [])

    // Compute bounding box
    const getROIBoundingBox = useCallback((roi: ROI): ROIBoundingBox => {
        const xs = roi.vertices.map(v => v.x)
        const ys = roi.vertices.map(v => v.y)

        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)

        return {
            minX,
            maxX,
            minY,
            maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY
        }
    }, [])

    const contextValue = useMemo((): ROIContextType => ({
        rois,
        addROI,
        removeROIs,
        clearAllROIs,
        selectedROIIds,
        setSelectedROIIds,
        toggleROISelection,
        clearROISelection,
        roisVisible,
        setROIsVisible,
        drawingState,
        startDrawing,
        addVertex,
        updatePreviewVertex,
        finishDrawing,
        cancelDrawing,
        getROIBoundingBox
    }), [
        rois, addROI, removeROIs, clearAllROIs,
        selectedROIIds, toggleROISelection, clearROISelection,
        roisVisible,
        drawingState, startDrawing, addVertex, updatePreviewVertex, finishDrawing, cancelDrawing,
        getROIBoundingBox
    ])

    return (
        <ROIContext.Provider value={contextValue}>
            {children}
        </ROIContext.Provider>
    )
}
