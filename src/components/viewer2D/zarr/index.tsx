'use client'

import { useEffect, useState } from 'react'

import NavigationControls from './nav/navigator'
import VivViewerWrapper from './map/VivViewerWrapper'
import { getDefaultMaxContrastLimit, getInitialNavigationState } from '../../../lib/utils/getDefaultNavStates'
import { useZarrStore } from '../../../lib/contexts/ZarrStoreContext'
import { useViewer2DData } from '../../../lib/contexts/Viewer2DDataContext'


export default function ZarrViewer() {
  const { hasLoadedArray, msInfo } = useZarrStore()
  const { navigationState, setNavigationState } = useViewer2DData()
  const [isControlsOpen, setIsControlsOpen] = useState(false)

  /**
   * When the store is loaded from ZarrStoreContext, we now initialise the viewer with defaults
   */
  useEffect(() => {
    if (!msInfo || navigationState) {
      return; // Guard against missing multiscale information or already initialized
    }

    // Get the default navigation state (z-slice, channel map, etc.)
    const initialNavState = getInitialNavigationState(msInfo);
    
    // Calculate default contrast limit based on data type
    const maxContrastLimit = getDefaultMaxContrastLimit(msInfo.dtype);

    // Set the full, initial navigation state, including default contrast limits for the first channel
    setNavigationState({
      ...initialNavState,
      contrastLimits: [maxContrastLimit, 1024] // Default cytoplasm is on
    });

  }, [hasLoadedArray, msInfo, navigationState, setNavigationState])

  return (
    <div className="w-full h-full flex relative overflow-hidden">
      {hasLoadedArray && msInfo && navigationState ? (
        <>
          <div className={`flex-1 transition-all duration-300 ${isControlsOpen ? 'mr-48' : ''}`}>
            <VivViewerWrapper />
          </div>

          <NavigationControls onToggle={setIsControlsOpen} />
        </>
      ) : (
        <div className="p-5 text-center text-gray-500 italic">
          Load a Zarr array to begin exploring with map-like navigation
        </div>
      )}
    </div>
  )
}
