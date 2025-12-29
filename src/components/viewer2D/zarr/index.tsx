'use client'

import { useEffect, useState } from 'react'

import NavigationControls from './nav/navigator'
import VivViewerWrapper from './map/VivViewerWrapper'
import { getInitialNavigationState } from '../../../lib/utils/getDefaultNavStates'
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

    // Set the full, initial navigation state with default contrast limits
    setNavigationState(initialNavState);

  }, [hasLoadedArray, msInfo, navigationState, setNavigationState])

  return (
    <div className="w-full h-full flex relative overflow-hidden">
      {/* Sidebar Controls (Contains File Explorer) - Always show if store exists */}
      {(hasLoadedArray || useZarrStore().store) && (
        <NavigationControls onToggle={setIsControlsOpen} />
      )}

      {hasLoadedArray && msInfo && navigationState ? (
        <div className={`flex-1 transition-all duration-300 ${isControlsOpen ? 'mr-48' : ''}`}>
          <VivViewerWrapper />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-5 text-center text-gray-500 italic">
          {useZarrStore().store 
            ? "Use the Server Explorer in the sidebar to load an image"
            : "Connect to a Zarr server to begin"}
        </div>
      )}
    </div>
  )
}
