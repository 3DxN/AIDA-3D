'use client'

import { useEffect } from 'react'

import ZarrViewerMenuBar from './menubar'
import VivViewerWrapper from './map/VivViewerWrapper'
import { getDefaultMaxContrastLimit, getInitialNavigationState } from '../../../lib/utils/getDefaultNavStates'
import { useZarrStore } from '../../../lib/contexts/ZarrStoreContext'
import { useViewer2DData } from '../../../lib/contexts/Viewer2DDataContext'


export default function ZarrViewer() {
  const { hasLoadedArray, msInfo } = useZarrStore()
  const { navigationState, setNavigationState } = useViewer2DData()

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
    <div className="h-full w-full flex flex-col">
      {hasLoadedArray && msInfo && navigationState ? (
        <>
          <ZarrViewerMenuBar />
          <div className="flex-1 min-h-0">
            <VivViewerWrapper />
          </div>
        </>
      ) : (
        <div className="p-5 text-center text-gray-500 italic">
          Load a Zarr array to begin exploring with map-like navigation
        </div>
      )}
    </div>
  )
}
