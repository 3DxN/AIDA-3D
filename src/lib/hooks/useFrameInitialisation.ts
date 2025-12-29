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
  // Track the previous msInfo to detect when we've loaded a NEW image
  const prevMsInfoRef = useRef<IMultiscaleInfo | null>(null)

  // 🛡️ FIX: Reset initialization flag when msInfo changes (new image loaded)
  useEffect(() => {
    if (msInfo && prevMsInfoRef.current !== msInfo) {
      // New image loaded - reset the initialization flag
      if (prevMsInfoRef.current !== null) {
        console.log('🔄 New image detected, resetting view initialization')
        hasInitialized.current = false
      }
      prevMsInfoRef.current = msInfo
    }
  }, [msInfo])
  
  useEffect(() => {
    if (msInfo && vivLoaders.length > 0 && !hasInitialized.current) {
      const shape = msInfo.shape
      const imageWidth = shape.x
      const imageHeight = shape.y

      if (!imageWidth || !imageHeight) {
        // Dims missing, return for now and come back later
        console.log('Missing dimensions for msInfo, cannot initialize frame center')
        return
      }

      console.log(`🎬 Initializing frame state for ${imageWidth}x${imageHeight} image`)

      // Set frame to center of image with reasonable default size
      const frameWidth = Math.min(100, imageWidth / 4)
      const frameHeight = Math.min(100, imageHeight / 4)
      setFrameCenter([imageWidth / 2, imageHeight / 2])
      setFrameSize([frameWidth, frameHeight])

      // Only initialize detail view state if it hasn't been set yet
      if (!controlledDetailViewState) {
        const containerWidth = containerDimensions.width || 800
        const containerHeight = containerDimensions.height || 600

        // 🛡️ FIX: Calculate zoom to fit ENTIRE IMAGE in view, not just the frame
        // This prevents the "black outside frame" perception by showing full context
        const padding = 1.1 // Small padding around the image
        const zoomToFitX = Math.log2(containerWidth / (imageWidth * padding))
        const zoomToFitY = Math.log2(containerHeight / (imageHeight * padding))

        // Use the smaller zoom to fit the whole image, but cap at reasonable min/max
        const zoom = Math.max(-2, Math.min(zoomToFitX, zoomToFitY, 1))

        const initialState = {
          target: [imageWidth / 2, imageHeight / 2, 0],
          zoom: zoom
        } satisfies VivViewState

        console.log(`📐 Initial view: target=[${imageWidth/2}, ${imageHeight/2}], zoom=${zoom.toFixed(2)} (fit ${imageWidth}x${imageHeight} in ${containerWidth}x${containerHeight})`)
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
