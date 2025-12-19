'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useViewer2DData } from './Viewer2DDataContext'
import type { ROI } from '../../types/roi'
import { generateROIId, generateROIColor, getPolygonCentroid, getPolygonBounds } from '../../types/roi'

const STORAGE_KEY = 'aida3d_rois'

interface ROIContextType {
  rois: ROI[]
  selectedROI: ROI | null
  isDrawing: boolean
  drawingPoints: [number, number][]
  cursorPosition: [number, number] | null
  startDrawing: () => void
  addPoint: (point: [number, number]) => boolean // returns true if polygon closed
  cancelDrawing: () => void
  finishDrawing: (name: string) => ROI | null
  selectROI: (id: string | null) => void
  navigateToROI: (id: string) => void
  deleteROI: (id: string) => void
  updateROI: (id: string, updates: Partial<Pick<ROI, 'name'>>) => void
  setCursorPosition: (pos: [number, number] | null) => void
}

const ROIContext = createContext<ROIContextType | null>(null)

export function useROI(): ROIContextType {
  const context = useContext(ROIContext)
  if (!context) throw new Error('useROI must be used within ROIProvider')
  return context
}

export function ROIProvider({ children }: { children: React.ReactNode }) {
  const { 
    navigationState, setNavigationState, 
    frameZLayersAbove, frameZLayersBelow, 
    setFrameCenter, setFrameSize,
    setFrameZLayersAbove, setFrameZLayersBelow,
    setControlledDetailViewState, setVivViewState, viewerSize
  } = useViewer2DData()

  const [rois, setROIs] = useState<ROI[]>([])
  const [selectedROI, setSelectedROI] = useState<ROI | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([])
  const [cursorPosition, setCursorPosition] = useState<[number, number] | null>(null)

  // Load from localStorage (validate format)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Only load ROIs that have the new format (points array, zRange)
        const valid = parsed.filter((r: any) => Array.isArray(r.points) && Array.isArray(r.zRange))
        setROIs(valid)
      }
    } catch {}
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rois))
  }, [rois])

  const startDrawing = useCallback(() => {
    setIsDrawing(true)
    setDrawingPoints([])
  }, [])

  const addPoint = useCallback((point: [number, number]): boolean => {
    if (!isDrawing) return false
    // Check if close to first point (within 15 pixels)
    if (drawingPoints.length >= 3) {
      const [fx, fy] = drawingPoints[0]
      const dist = Math.sqrt((point[0] - fx) ** 2 + (point[1] - fy) ** 2)
      if (dist < 15) return true // Signal to close polygon
    }
    setDrawingPoints(prev => [...prev, point])
    return false
  }, [isDrawing, drawingPoints])

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false)
    setDrawingPoints([])
  }, [])

  const finishDrawing = useCallback((name: string): ROI | null => {
    if (drawingPoints.length < 3) return null
    const zSlice = navigationState?.zSlice ?? 0
    const roi: ROI = {
      id: generateROIId(),
      name: name || `ROI ${rois.length + 1}`,
      points: drawingPoints,
      zRange: [Math.max(0, zSlice - frameZLayersBelow), zSlice + frameZLayersAbove],
      color: generateROIColor(),
      createdAt: new Date().toISOString()
    }
    setROIs(prev => [...prev, roi])
    setIsDrawing(false)
    setDrawingPoints([])
    setSelectedROI(null)
    return roi
  }, [drawingPoints, navigationState, frameZLayersAbove, frameZLayersBelow, rois.length])

  const selectROI = useCallback((id: string | null) => {
    setSelectedROI(id ? rois.find(r => r.id === id) || null : null)
  }, [rois])

  const navigateToROI = useCallback((id: string) => {
    const roi = rois.find(r => r.id === id)
    if (!roi || !navigationState) return
    const { center, size } = getPolygonBounds(roi.points)
    const zCenter = Math.floor((roi.zRange[0] + roi.zRange[1]) / 2)
    
    setFrameCenter(center)
    setFrameSize(size)
    setNavigationState({ ...navigationState, zSlice: zCenter })
    
    if (viewerSize.width > 0 && viewerSize.height > 0) {
      const padding = 1.2
      const zoomX = Math.log2(viewerSize.width / (size[0] * padding))
      const zoomY = Math.log2(viewerSize.height / (size[1] * padding))
      const zoom = Math.min(zoomX, zoomY)
      
      const targetState = {
        target: [center[0], center[1], 0] as [number, number, number],
        zoom: zoom
      }

      setVivViewState(targetState)
      setControlledDetailViewState(targetState)
    }

    const layersBelow = zCenter - roi.zRange[0]
    const layersAbove = roi.zRange[1] - zCenter
    setFrameZLayersBelow(layersBelow)
    setFrameZLayersAbove(layersAbove)
    setSelectedROI(roi)
  }, [rois, navigationState, setFrameCenter, setFrameSize, setNavigationState, setFrameZLayersAbove, setFrameZLayersBelow, viewerSize, setControlledDetailViewState, setVivViewState])

  const deleteROI = useCallback((id: string) => {
    setROIs(prev => prev.filter(r => r.id !== id))
    if (selectedROI?.id === id) setSelectedROI(null)
  }, [selectedROI])

  const updateROI = useCallback((id: string, updates: Partial<Pick<ROI, 'name'>>) => {
    setROIs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }, [])

  return (
    <ROIContext.Provider value={{
      rois, selectedROI, isDrawing, drawingPoints, cursorPosition,
      startDrawing, addPoint, cancelDrawing, finishDrawing,
      selectROI, navigateToROI, deleteROI, updateROI, setCursorPosition
    }}>
      {children}
    </ROIContext.Provider>
  )
}
