'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useViewer2DData } from './Viewer2DDataContext'
import type { ROI } from '../../types/roi'
import { generateROIId } from '../../types/roi'

const STORAGE_KEY = 'aida3d_rois'

interface ROIContextType {
  rois: ROI[]
  saveCurrentAsROI: (name: string) => ROI
  navigateToROI: (id: string) => void
  deleteROI: (id: string) => void
  renameROI: (id: string, name: string) => void
}

const ROIContext = createContext<ROIContextType | null>(null)

export function useROI(): ROIContextType {
  const context = useContext(ROIContext)
  if (!context) throw new Error('useROI must be used within ROIProvider')
  return context
}

export function ROIProvider({ children }: { children: React.ReactNode }) {
  const {
    frameCenter, frameSize,
    frameZLayersAbove, frameZLayersBelow,
    setFrameCenter, setFrameSize,
    setFrameZLayersAbove, setFrameZLayersBelow,
    navigationState, setNavigationState
  } = useViewer2DData()

  const [rois, setROIs] = useState<ROI[]>([])

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Validate format
        const valid = parsed.filter((r: any) =>
          r.id && r.frameCenter && r.frameSize && typeof r.zSlice === 'number'
        )
        setROIs(valid)
      }
    } catch {}
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rois))
  }, [rois])

  const saveCurrentAsROI = useCallback((name: string): ROI => {
    const roi: ROI = {
      id: generateROIId(),
      name: name || `ROI ${rois.length + 1}`,
      frameCenter: [...frameCenter] as [number, number],
      frameSize: [...frameSize] as [number, number],
      zSlice: navigationState?.zSlice ?? 0,
      zLayersAbove: frameZLayersAbove,
      zLayersBelow: frameZLayersBelow,
      createdAt: new Date().toISOString()
    }
    setROIs(prev => [...prev, roi])
    return roi
  }, [frameCenter, frameSize, frameZLayersAbove, frameZLayersBelow, navigationState, rois.length])

  const navigateToROI = useCallback((id: string) => {
    const roi = rois.find(r => r.id === id)
    if (!roi || !navigationState) return

    setFrameCenter(roi.frameCenter)
    setFrameSize(roi.frameSize)
    setFrameZLayersAbove(roi.zLayersAbove)
    setFrameZLayersBelow(roi.zLayersBelow)
    setNavigationState({ ...navigationState, zSlice: roi.zSlice })
  }, [rois, navigationState, setFrameCenter, setFrameSize, setFrameZLayersAbove, setFrameZLayersBelow, setNavigationState])

  const deleteROI = useCallback((id: string) => {
    setROIs(prev => prev.filter(r => r.id !== id))
  }, [])

  const renameROI = useCallback((id: string, name: string) => {
    setROIs(prev => prev.map(r => r.id === id ? { ...r, name } : r))
  }, [])

  return (
    <ROIContext.Provider value={{
      rois,
      saveCurrentAsROI,
      navigateToROI,
      deleteROI,
      renameROI
    }}>
      {children}
    </ROIContext.Provider>
  )
}
