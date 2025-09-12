import React from 'react'
import { VivViewer } from '@hms-dbmi/viv'

import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import { useFrameInteraction } from '../../../../lib/hooks/useFrameInteraction'
import useVivViewer from '../../../../lib/hooks/useVivViewer'
import useFrameInitialisation from '../../../../lib/hooks/useFrameInitialisation'
import { CellposeOverlay } from './CellposeOverlay'


const VivViewerWrapper: React.FC = () => {
    const { root, msInfo } = useZarrStore()
    const {
        navigationState,
        frameCenter,
        frameSize,
        frameZDepth,
        setFrameCenter,
        setFrameSize,
        frameBoundCellposeData
    } = useViewer2DData()

    // Early return if required data not available
    if (!msInfo || !navigationState) {
        return <div className="flex items-center justify-center h-full text-gray-500">Loading viewer...</div>
    }

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

    // Frame interaction hook no longer needs to create the overlay
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
        frameZDepth,
        setFrameCenter,
        setFrameSize,
        msInfo,
        frameBoundCellposeData, // keep for potential future use, but not for overlay
        navigationState,
        detailViewStateRef,
        setIsManuallyPanning,
        setDetailViewDrag,
        detailViewDrag,
        setControlledDetailViewState,
    )

    // Generate final layer props with frame overlays using the original architecture
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
            <CellposeOverlay
                viewState={controlledDetailViewState}
                containerSize={containerDimensions}
            />
        </div>
    )
}

export default VivViewerWrapper;