import { useEffect, useRef } from 'react'

import type ZarrPixelSource from '../ext/ZarrPixelSource'
import type { VivViewState } from '../../types/viewer2D/vivViewer'
import type { IMultiscaleInfo } from '../../types/metadata/loader'


/**
 * Hook to manage frame initialisation based on array dimensions
 * Sets initial frame center, size, and detail view state
 */
export default function useFrameInitialisation(
  msInfo: IMultiscaleInfo,
  vivLoaders: ZarrPixelSource[],
  containerDimensions: { width: number; height: number },
  controlledDetailViewState: VivViewState | null,
  setFrameCenter: (center: [number, number]) => void,
  setFrameSize: (size: [number, number]) => void,
  setControlledDetailViewState: (state: VivViewState) => void,
  detailViewStateRef: React.RefObject<VivViewState | null>
) {
  // Track if we've already initialized to prevent re-initialization on view state changes
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    if (msInfo && vivLoaders.length > 0 && !hasInitialized.current) {
      const shape = msInfo.shape
      const width = shape.x
      const height = shape.y

      if (!width || !height) {
        // Dims missing, return for now and come back later
        console.log('Missing dimensions for msInfo, cannot initialize frame center')
        return
      }

      console.log('Initializing frame state and view state for the first time')
      
      setFrameCenter([width / 2, height / 2])

      // Only initialize detail view state if it hasn't been set yet
      if (!controlledDetailViewState) {
        // Initialize detail view state to show the frame selection area
        // Calculate zoom level to fit the frame with some padding
        const frameWidth = 100  // Default frame width
        const frameHeight = 100 // Default frame height
        const padding = 1.5     // Add 50% padding around frame

        const containerWidth = containerDimensions.width || 800
        const containerHeight = containerDimensions.height || 600

        // Calculate zoom to fit frame with padding
        const zoomX = Math.log2(containerWidth / (frameWidth * padding))
        const zoomY = Math.log2(containerHeight / (frameHeight * padding))
        const zoom = Math.min(zoomX, zoomY, 2) // Cap at zoom level 2

        const initialState = {
          target: [width / 2, height / 2, 0],
          zoom: zoom
        } satisfies VivViewState

        console.log('Setting initial view state to fit frame:', initialState)
        detailViewStateRef.current = initialState
        setControlledDetailViewState(initialState)
      }
      
      // Mark as initialized to prevent future re-initializations
      hasInitialized.current = true
    }
  }, [
    msInfo, 
    vivLoaders, 
    containerDimensions,
    setFrameCenter,
    setFrameSize,
    setControlledDetailViewState,
    detailViewStateRef
    // Note: Removed controlledDetailViewState from dependencies to prevent re-initialization
  ])
}
