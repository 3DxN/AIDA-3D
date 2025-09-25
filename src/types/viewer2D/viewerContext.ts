// Viewer2D data context types for unified 2D viewer state management

import type * as zarrita from 'zarrita'

import type { NavigationState } from './navState'
import type { VivViewState } from './vivViewer'
import type { ViewerSize } from './dimensions'


export interface Viewer2DDataContextType {
  // Frame state (replaces FrameStateContext)
  frameCenter: [number, number]
  frameSize: [number, number]
  frameZLayersAbove: number
  frameZLayersBelow: number
  setFrameCenter: (center: [number, number]) => void
  setFrameSize: (size: [number, number]) => void
  setFrameZLayersAbove: (layers: number) => void
  setFrameZLayersBelow: (layers: number) => void
  getFrameBounds: () => {
    left: number
    right: number
    top: number
    bottom: number
  }
  
  // View state
  currentViewBounds: { x1: number, y1: number, x2: number, y2: number } | null
  currentZSlice: number
  currentTimeSlice: number
  setViewBounds: (bounds: { x1: number, y1: number, x2: number, y2: number }) => void
  setZSlice: (z: number) => void
  setTimeSlice: (t: number) => void
  
  // Navigation state integration
  navigationState: NavigationState | null
  setNavigationState: (state: NavigationState) => void
  
  // Viv viewer state integration  
  vivViewState: VivViewState | null
  setVivViewState: (state: VivViewState) => void

  // Viewer container dimensions
  viewerSize: ViewerSize
  setViewerSize: (size: ViewerSize) => void
  
  // Data access
  frameBoundCellposeData: zarrita.Chunk<zarrita.DataType> | null
  isDataLoading: boolean
  dataError: string | null
}

export interface Viewer2DDataProviderProps {
  children: React.ReactNode
}
