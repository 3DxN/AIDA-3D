'use client'

import React, { 
    createContext, useContext, useState,
    useCallback, useMemo, useEffect
} from 'react'
import * as zarrita from 'zarrita'

import { useZarrStore } from './ZarrStoreContext'

import type { VivViewState } from '../../types/viewer2D/vivViewer'
import type { 
    Viewer2DDataContextType, Viewer2DDataProviderProps
} from '../../types/viewer2D/viewerContext'
import type { NavigationState } from '../../types/viewer2D/navState'
import type { ViewerSize } from '../../types/viewer2D/dimensions'


const Viewer2DDataContext = createContext<Viewer2DDataContextType | null>(null)

export function useViewer2DData(): Viewer2DDataContextType {
  const context = useContext(Viewer2DDataContext)
  if (!context) {
    throw new Error('useViewer2DData must be used within a Viewer2DDataProvider')
  }
  return context
}

export function Viewer2DDataProvider({ children }: Viewer2DDataProviderProps) {
  const {
    msInfo,
    cellposeArrays,
    cellposeScales,
    selectedCellposeOverlayResolution,
    selectedCellposeMeshResolution,
    isCellposeLoading,
    cellposeError
  } = useZarrStore()
  
  // Frame state (replacing FrameStateContext)
  const [frameCenter, setFrameCenter] = useState<[number, number]>([500, 500])
  const [frameSize, setFrameSize] = useState<[number, number]>([100, 100])
  const [frameZLayersAbove, setFrameZLayersAbove] = useState<number>(30)
  const [frameZLayersBelow, setFrameZLayersBelow] = useState<number>(30)
  
  // View state
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null)
  const [vivViewState, setVivViewState] = useState<VivViewState | null>(null)
  const [controlledDetailViewState, setControlledDetailViewState] = useState<VivViewState | null>(null)

  // Measured viewer container size
  const [viewerSize, setViewerSize] = useState<ViewerSize>({ width: 0, height: 0 })
  
  // Data loading state
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [frameBoundCellposeData, setFrameBoundCellposeData]
    = useState<zarrita.Chunk<zarrita.DataType> | null>(null)
  const [frameBoundCellposeMeshData, setFrameBoundCellposeMeshData]
    = useState<zarrita.Chunk<zarrita.DataType> | null>(null)
  
  // Frame bounds calculation
  const getFrameBounds = useCallback(() => {
    const [centerX, centerY] = frameCenter
    const [width, height] = frameSize
    const halfWidth = width / 2
    const halfHeight = height / 2

    return {
      left: centerX - halfWidth,
      right: centerX + halfWidth,
      top: centerY - halfHeight,
      bottom: centerY + halfHeight,
    }
  }, [frameCenter, frameSize])
  
  // Current view bounds calculation from viv view state
  const currentViewBounds = useMemo(() => {
    if (!vivViewState || !msInfo || viewerSize.width <= 0 || viewerSize.height <= 0) return null
    
    // This is a simplified calculation - you might need to adjust based on your viewer setup
    const [targetX, targetY] = vivViewState.target
    const zoom = vivViewState.zoom
    
    // Calculate view bounds based on approximated zoom and measured container size
    const zoomScale = Math.pow(2, zoom)
    const viewWidth = viewerSize.width / zoomScale
    const viewHeight = viewerSize.height / zoomScale 
    
    return {
      x1: targetX - viewWidth / 2,
      y1: targetY - viewHeight / 2,
      x2: targetX + viewWidth / 2,
      y2: targetY + viewHeight / 2
    }
  }, [vivViewState, msInfo, viewerSize])
  
  // View bounds setter
  const setViewBounds = useCallback((bounds: { x1: number, y1: number, x2: number, y2: number }) => {
    const centerX = (bounds.x1 + bounds.x2) / 2
    const centerY = (bounds.y1 + bounds.y2) / 2
    const width = bounds.x2 - bounds.x1
    const height = bounds.y2 - bounds.y1
    
    // Calculate appropriate zoom level using measured viewer size and fallback to sensible defaults
    const vw = viewerSize.width > 0 ? viewerSize.width : 1000
    const vh = viewerSize.height > 0 ? viewerSize.height : 600
    const zoom = Math.log2(Math.min(vw / width, vh / height)) // Approximate
    
    setVivViewState({
      target: [centerX, centerY, 0],
      zoom: zoom
    })
  }, [viewerSize])
  
  // Z/T slice setters
  const setZSlice = useCallback((z: number) => {
    if (navigationState) {
      setNavigationState({
        ...navigationState,
        zSlice: z
      })
    }
  }, [navigationState])
  
  const setTimeSlice = useCallback((t: number) => {
    if (navigationState) {
      setNavigationState({
        ...navigationState,
        timeSlice: t
      })
    }
  }, [navigationState])
  
  // Get current Z/T slices
  const currentZSlice = navigationState?.zSlice ?? 0
  const currentTimeSlice = navigationState?.timeSlice ?? 0
  
  // Helper function for frame-bound array slicing (DRY principle)
  const getFrameBoundData = useCallback(async (
    array: zarrita.Array<zarrita.DataType>,
  ): Promise<zarrita.Chunk<zarrita.DataType> | null> => {
    if (!navigationState) {
      return null
    }

    try {
      // Calculate frame bounds (these are in resolution 0 coordinates)
      const bounds = getFrameBounds()

      // Get the scale factor for the current overlay resolution
      // cellposeScales[i] = [z_scale, y_scale, x_scale]
      const scale = cellposeScales[selectedCellposeOverlayResolution] || [1.0, 1.0, 1.0]
      const xScale = scale[2] // x is the last dimension
      const yScale = scale[1] // y is the second-to-last dimension
      const zScale = scale[0] // z is the first dimension

      console.log(`   Scale factors for overlay resolution ${selectedCellposeOverlayResolution}: Z=${zScale}, Y=${yScale}, X=${xScale}`)

      // Scale the bounds to the current resolution
      // If scale is 2.0, we divide by 2 to get lower resolution coordinates
      const scaledLeft = bounds.left / xScale
      const scaledRight = bounds.right / xScale
      const scaledTop = bounds.top / yScale
      const scaledBottom = bounds.bottom / yScale

      // Add spatial bounds (ensure they're within array bounds)
      const maxX = array.shape[array.shape.length - 1]
      const maxY = array.shape[array.shape.length - 2]

      const x1 = Math.max(0, Math.floor(scaledLeft))
      const x2 = Math.min(maxX, Math.ceil(scaledRight))
      const y1 = Math.max(0, Math.floor(scaledTop))
      const y2 = Math.min(maxY, Math.ceil(scaledBottom))

      console.log(`   Scaled bounds: [${y1}:${y2}, ${x1}:${x2}] (array max: ${maxY} × ${maxX})`)
      
      // Create array-based selection based on array dimensions
      const selection: (number | zarrita.Slice | null)[] = []
      
      // Build selection array based on actual array shape
      const hasZ = array.shape.length > 2 && msInfo?.shape.z && msInfo.shape.z >= 1
      if (hasZ) {
        // For 2D overlay, get ONLY the current z slice (high-res single layer)
        const scaledZ = Math.floor(currentZSlice / zScale)
        const clampedZ = Math.max(0, Math.min(array.shape[0] - 1, scaledZ))
        console.log(`   Getting single Z layer at index ${clampedZ} (original: ${currentZSlice}, scaled: ${scaledZ})`)
        selection.push(clampedZ)
      }
      selection.push(zarrita.slice(y1, y2))
      selection.push(zarrita.slice(x1, x2))
      
      const result = await zarrita.get(array, selection)
      return result

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Error getting frame-bound main data:`, errorMsg)
      throw error
    }
  }, [navigationState, getFrameBounds, currentZSlice, currentTimeSlice, frameZLayersAbove, frameZLayersBelow, msInfo, cellposeScales, selectedCellposeOverlayResolution])
  
  // Auto-update frame-bound Cellpose data when dependencies change
  useEffect(() => {
    const loadFrameBoundCellposeData = async () => {
      const cellposeArray = cellposeArrays[selectedCellposeOverlayResolution]

      if (!cellposeArray || !navigationState) {
        setFrameBoundCellposeData(null)
        return
      }

      console.log(`🔄 Loading frame-bound Cellpose data at overlay resolution ${selectedCellposeOverlayResolution}, array shape: ${cellposeArray.shape.join(' × ')}`)

      setIsDataLoading(true)
      setDataError(null)

      try {
        // Use shared helper function
        const result = await getFrameBoundData(cellposeArray)
        console.log(`✅ Frame-bound Cellpose data loaded, chunk shape: ${result?.shape.join(' × ') || 'null'}`)
        setFrameBoundCellposeData(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ Error getting frame-bound Cellpose data:', errorMsg)
        setDataError(errorMsg)
        setFrameBoundCellposeData(null)
      } finally {
        setIsDataLoading(false)
      }
    }

    loadFrameBoundCellposeData()
  }, [cellposeArrays, selectedCellposeOverlayResolution, navigationState, frameCenter, frameSize, frameZLayersAbove, frameZLayersBelow, currentZSlice, currentTimeSlice, getFrameBoundData])

  // Auto-update frame-bound Cellpose MESH data when dependencies change (low-res all Z layers)
  useEffect(() => {
    const loadFrameBoundCellposeMeshData = async () => {
      const cellposeMeshArray = cellposeArrays[selectedCellposeMeshResolution]

      if (!cellposeMeshArray || !navigationState) {
        setFrameBoundCellposeMeshData(null)
        return
      }

      console.log(`🔄 Loading frame-bound Cellpose MESH data at mesh resolution ${selectedCellposeMeshResolution}, array shape: ${cellposeMeshArray.shape.join(' × ')}`)

      setIsDataLoading(true)
      setDataError(null)

      try {
        // Get scale factor for mesh resolution
        const meshScale = cellposeScales[selectedCellposeMeshResolution] || [1.0, 1.0, 1.0]
        const xScale = meshScale[2]
        const yScale = meshScale[1]
        const zScale = meshScale[0]

        // Calculate frame bounds (in resolution 0 coordinates)
        const bounds = getFrameBounds()

        // Scale the bounds to the mesh resolution
        const scaledLeft = bounds.left / xScale
        const scaledRight = bounds.right / xScale
        const scaledTop = bounds.top / yScale
        const scaledBottom = bounds.bottom / yScale

        // Add spatial bounds (ensure they're within array bounds)
        const maxX = cellposeMeshArray.shape[cellposeMeshArray.shape.length - 1]
        const maxY = cellposeMeshArray.shape[cellposeMeshArray.shape.length - 2]

        const x1 = Math.max(0, Math.floor(scaledLeft))
        const x2 = Math.min(maxX, Math.ceil(scaledRight))
        const y1 = Math.max(0, Math.floor(scaledTop))
        const y2 = Math.min(maxY, Math.ceil(scaledBottom))

        console.log(`   Mesh resolution scale factors: Z=${zScale}, Y=${yScale}, X=${xScale}`)
        console.log(`   Mesh scaled bounds: [${y1}:${y2}, ${x1}:${x2}] (array max: ${maxY} × ${maxX})`)

        // Create selection for ALL Z layers (for mesh creation)
        const selection: (number | zarrita.Slice | null)[] = []

        const hasZ = cellposeMeshArray.shape.length > 2 && msInfo?.shape.z && msInfo.shape.z >= 1
        if (hasZ) {
          // For mesh creation, get ALL Z layers within the frame bounds
          const startZ = Math.max(0, currentZSlice - frameZLayersBelow)
          const endZ = Math.min(msInfo.shape.z || 0, currentZSlice + frameZLayersAbove + 1)

          // Scale to mesh resolution
          const scaledStartZ = Math.floor(startZ / zScale)
          const scaledEndZ = Math.ceil(endZ / zScale)
          const clampedStartZ = Math.max(0, scaledStartZ)
          const clampedEndZ = Math.min(cellposeMeshArray.shape[0], Math.max(scaledEndZ, clampedStartZ + 1))

          console.log(`   Getting Z layers ${clampedStartZ}:${clampedEndZ} (original: ${startZ}:${endZ})`)
          selection.push(zarrita.slice(clampedStartZ, clampedEndZ))
        }
        selection.push(zarrita.slice(y1, y2))
        selection.push(zarrita.slice(x1, x2))

        const result = await zarrita.get(cellposeMeshArray, selection)
        console.log(`✅ Frame-bound Cellpose MESH data loaded, chunk shape: ${result?.shape.join(' × ') || 'null'}`)
        setFrameBoundCellposeMeshData(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ Error getting frame-bound Cellpose MESH data:', errorMsg)
        setDataError(errorMsg)
        setFrameBoundCellposeMeshData(null)
      } finally {
        setIsDataLoading(false)
      }
    }

    loadFrameBoundCellposeMeshData()
  }, [cellposeArrays, selectedCellposeMeshResolution, navigationState, frameCenter, frameSize, frameZLayersAbove, frameZLayersBelow, currentZSlice, msInfo, cellposeScales, getFrameBounds])

  // Get current cellpose scale for mesh creation (3D viewer uses this)
  const cellposeScale = cellposeScales[selectedCellposeMeshResolution] || [1.0, 1.0, 1.0]

  const contextValue: Viewer2DDataContextType = {
    // Frame state
    frameCenter,
    frameSize,
    frameZLayersAbove,
    frameZLayersBelow,
    setFrameCenter,
    setFrameSize,
    setFrameZLayersAbove,
    setFrameZLayersBelow,
    getFrameBounds,

    // View state
    currentViewBounds,
    currentZSlice,
    currentTimeSlice,
    setViewBounds,
    setZSlice,
    setTimeSlice,

    // Navigation state
    navigationState,
    setNavigationState,

    // Viv viewer state
    vivViewState,
    setVivViewState,
    controlledDetailViewState,
    setControlledDetailViewState,

    // Viewer size
    viewerSize,
    setViewerSize,

    // Data access
    frameBoundCellposeData,
    frameBoundCellposeMeshData,
    isDataLoading: isDataLoading || isCellposeLoading,
    dataError: dataError || cellposeError,

    // Cellpose resolution and scaling
    cellposeScale
  }
  
  return (
    <Viewer2DDataContext.Provider value={contextValue}>
      {children}
    </Viewer2DDataContext.Provider>
  )
}
