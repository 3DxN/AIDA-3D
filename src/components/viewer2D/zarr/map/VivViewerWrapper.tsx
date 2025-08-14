import React from 'react'
import { VivViewer } from '@hms-dbmi/viv'

import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import { useFrameInteraction } from '../../../../lib/hooks/useFrameInteraction'
import useVivViewer from '../../../../lib/hooks/useVivViewer'
import useFrameInitialisation from '../../../../lib/hooks/useFrameInitialisation'

import type { NavigationState } from '../../../../types/viewer2D/navState'
import type { IMultiscaleInfo } from '../../../../types/metadata/loader'


const VivViewerWrapper: React.FC<{
  msInfo: IMultiscaleInfo
  navigationState: NavigationState
}> = ({
  msInfo,
  navigationState,
}) => {
  const { root } = useZarrStore()
  const { frameCenter, frameSize, setFrameCenter, setFrameSize } = useViewer2DData()
  
  // Use the comprehensive Viv viewer hook first 
  const {
    vivLoaders,
    containerDimensions,
    detailViewDrag,
    controlledDetailViewState,
    detailViewStateRef,
    containerRef,
    views,
    viewStates,
    setDetailViewDrag,
    setControlledDetailViewState,
    setIsManuallyPanning,
    handleViewStateChange,
    createLayerProps
  } = useVivViewer(msInfo, navigationState, root)
  
  // Use frame interaction hook with proper refs
  const {
    handleHover,
    getCursor,
    frameOverlayLayers,
    onDragStart,
    onDrag,
    onDragEnd,
    onClick
  } = useFrameInteraction(
    frameCenter, 
    frameSize, 
    setFrameCenter, 
    setFrameSize, 
    msInfo,
    detailViewStateRef,
    setIsManuallyPanning,
    setDetailViewDrag,
    detailViewDrag,
    setControlledDetailViewState,
  )

  // Generate final layer props with frame overlays
  const finalLayerProps = createLayerProps(frameOverlayLayers)

  // Initialize frame when data is loaded
  useFrameInitialisation(
    msInfo,
    vivLoaders,
    containerDimensions,
    controlledDetailViewState,
    setFrameCenter,
    setFrameSize,
    setControlledDetailViewState,
    detailViewStateRef
  )

  // Loading state
  if (!msInfo || vivLoaders.length === 0 || views.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-50"
      >
        <div className="text-center">
          <div className="text-lg mb-2.5">No data loaded</div>
          <div className="text-sm text-gray-500">Load a Zarr array to begin viewing</div>
        </div>
      </div>
    )
  }

  // Main viewer render
  return (
    <div 
      ref={containerRef}
      className="viv-viewer-container w-full h-full min-h-[400px] relative overflow-hidden"
      tabIndex={0}
    >
      <VivViewer
        views={views}
        layerProps={finalLayerProps}
        viewStates={viewStates}
        // @ts-expect-error Incomplete viv type definitions
        onViewStateChange={handleViewStateChange}
        deckProps={{
          style: { backgroundColor: 'black' },
          controller: {
            dragPan: true,
            scrollZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            dragRotate: false,
            touchRotate: false,
            keyboard: true
          },
          pickingRadius: 15,
          onDragStart,
          onDrag,
          onDragEnd,
          onClick,
          onHover: handleHover,
          getCursor
        }}
      />
    </div>
  )
}

export default VivViewerWrapper;
