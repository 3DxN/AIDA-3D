'use client'

import { useState, useEffect } from 'react'

import NavigationControls from './nav/navigator'
import VivViewerWrapper from './map/VivViewerWrapper'
import { getDefaultMaxContrastLimit, getInitialNavigationState } from '../../../lib/utils/getDefaultNavStates'
import { useZarrStore } from '../../../lib/contexts/ZarrStoreContext'
import { useViewer2DData } from '../../../lib/contexts/Viewer2DDataContext'

import type { 
  NavigationLimits, 
  NavigationHandlers
} from '../../../types/viewer2D/navState'
import type { ChannelMapping, ContrastLimits } from '../../../types/viewer2D/navTypes'


export default function ZarrViewer() {
  const { hasLoadedArray, msInfo } = useZarrStore()
  const { navigationState, setNavigationState } = useViewer2DData()
  
  // Navigation limits and handlers (state managed by context)
  const [navigationLimits, setNavigationLimits] = useState<NavigationLimits | null>(null)
  const navigationHandlers: NavigationHandlers = {
    onXOffsetChange: (value: number) => navigationState && setNavigationState({ ...navigationState, xOffset: value }),
    onYOffsetChange: (value: number) => navigationState && setNavigationState({ ...navigationState, yOffset: value }),
    onZSliceChange: (value: number) => navigationState && setNavigationState({ ...navigationState, zSlice: value }),
    onTimeSliceChange: (value: number) => navigationState && setNavigationState({ ...navigationState, timeSlice: value }),
    onContrastLimitsChange: (limits: ContrastLimits) => navigationState && setNavigationState({
      ...navigationState, contrastLimits: limits
    }),
    onChannelChange: (role: keyof ChannelMapping, value: number | null) => navigationState && setNavigationState({
      ...navigationState,
      channelMap: {
        ...navigationState.channelMap,
        [role]: value
      }
    })
  }

  /**
   * When the store is loaded from ZarrStoreContext, we now initialise the viewer with defaults
   */
  useEffect(() => {
    if (!msInfo || navigationState) {
      return; // Guard against missing multiscale information or already initialized
    }

    // Get the default navigation state (z-slice, channel map, etc.)
    const initialNavState = getInitialNavigationState(msInfo);
    
    // Calculate navigation limits based on the array's shape and data type
    const shape = msInfo.shape;
    const maxContrastLimit = getDefaultMaxContrastLimit(msInfo.dtype);

    setNavigationLimits({
      maxXOffset: 0,
      maxYOffset: 0,
      maxZSlice: shape.z ?? 0,
      maxTimeSlice: shape.t ?? 0,
      numChannels: msInfo.channels.length,
      maxContrastLimit
    });

    // Set the full, initial navigation state, including default contrast limits for the first channel
    setNavigationState({
      ...initialNavState,
      contrastLimits: [maxContrastLimit, 1024] // Default cytoplasm is on
    });

  }, [hasLoadedArray, msInfo, navigationState, setNavigationState]) // When the store is loaded, initialize with default values

  return (
    <div className="h-full min-h-[500px] flex flex-col">

      {hasLoadedArray && msInfo && navigationState && navigationLimits ? (
        <div className="flex gap-5 items-stretch flex-1 min-h-0">
          <div className="flex-1 min-w-[60%] flex flex-col">
            <VivViewerWrapper
              msInfo={msInfo}
              navigationState={navigationState}
            />
          </div>

          <NavigationControls
            msInfo={msInfo}
            navigationState={navigationState}
            navigationLimits={navigationLimits}
            navigationHandlers={navigationHandlers}
          />
        </div>
      ) : (
        <div className="p-5 text-center text-gray-500 italic">
          Load a Zarr array to begin exploring with map-like navigation
        </div>
      )}
    </div>
  )
}
