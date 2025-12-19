import React, { useState, useCallback } from 'react'
import { VivViewer, DETAIL_VIEW_ID } from '@hms-dbmi/viv'

import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import { useROI } from '../../../../lib/contexts/ROIContext'
import { useFrameInteraction } from '../../../../lib/hooks/useFrameInteraction'
import useVivViewer from '../../../../lib/hooks/useVivViewer'
import useFrameInitialisation from '../../../../lib/hooks/useFrameInitialisation'
import { CellposeOverlay } from './CellposeOverlay'
import { SelectionBox } from '../../overlay/SelectionBox'
import { HistogramEqualizationOverlay } from '../../effects/HistogramEqualizationOverlay'
import { ROIOverlay } from '../../overlay/ROIOverlay'
import { ROIDrawingOverlay } from '../../overlay/ROIDrawingOverlay'


const VivViewerWrapper: React.FC = () => {
    const { root, msInfo } = useZarrStore()
    const { 
        navigationState, setFrameCenter, setFrameSize,
        controlledDetailViewState, setControlledDetailViewState,
        vivViewState 
    } = useViewer2DData()
    const { rois, selectedROI, isDrawing, drawingPoints, cursorPosition, addPoint, finishDrawing, setCursorPosition } = useROI()

    // Early return if required data not available
    if (!msInfo || !navigationState) {
        return <div className="flex items-center justify-center h-full text-gray-500">Loading viewer...</div>
    }

    const {
        vivLoaders,
        containerDimensions,
        detailViewDrag,
        detailViewStateRef,
        containerRef,
        views,
        viewStates,
        initialViewState,
        setDetailViewDrag,
        setIsManuallyPanning,
        handleViewStateChange,
        createLayerProps
    } = useVivViewer(msInfo, navigationState, root, controlledDetailViewState, setControlledDetailViewState)

    const {
        handleHover,
        getCursor,
        frameOverlayLayers,
        selectionBox,
        onDragStart,
        onDrag,
        onDragEnd,
        onClick
    } = useFrameInteraction(
        detailViewStateRef,
        setIsManuallyPanning,
        setDetailViewDrag,
        detailViewDrag,
        setControlledDetailViewState,
    )

    const finalLayerProps = createLayerProps(frameOverlayLayers)

    const handleHoverWithCursor = useCallback((info: any) => {
        if (isDrawing && info.coordinate && info.viewport?.id === DETAIL_VIEW_ID) {
            setCursorPosition([info.coordinate[0], info.coordinate[1]])
        } else if (!isDrawing && cursorPosition) {
            setCursorPosition(null)
        }
        return handleHover(info)
    }, [isDrawing, handleHover, setCursorPosition, cursorPosition])

    const [showNamePrompt, setShowNamePrompt] = useState(false)
    const [pendingROIName, setPendingROIName] = useState('')

    const handleClick = useCallback((info: any, event: any) => {
        if (isDrawing && info.coordinate && info.viewport?.id === DETAIL_VIEW_ID) {
            const [x, y] = info.coordinate
            const shouldClose = addPoint([x, y])
            if (shouldClose) {
                setShowNamePrompt(true)
            }
            return true
        }
        return onClick(info, event)
    }, [isDrawing, addPoint, onClick])

    const handleFinishROI = useCallback(() => {
        finishDrawing(pendingROIName || `ROI ${rois.length + 1}`)
        setPendingROIName('')
        setShowNamePrompt(false)
    }, [finishDrawing, pendingROIName, rois.length])

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

    if (!msInfo || vivLoaders.length === 0 || views.length === 0 || !viewStates || viewStates.length === 0) {
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

    const currentViewState = vivViewState || controlledDetailViewState;

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
                initialViewState={initialViewState}
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
                    onClick: handleClick,
                    onHover: handleHoverWithCursor,
                    getCursor
                }}
            />
            <HistogramEqualizationOverlay
                enabled={navigationState.histogramEqualizationOn}
                containerRef={containerRef}
                viewState={currentViewState}
                containerSize={containerDimensions}
            />
            <CellposeOverlay
                viewState={currentViewState}
                containerSize={containerDimensions}
            />
            <SelectionBox
                selectionBox={selectionBox}
                containerSize={containerDimensions}
            />
            <ROIOverlay
                viewState={currentViewState}
                containerSize={containerDimensions}
                rois={rois}
                selectedId={selectedROI?.id ?? null}
                zSlice={navigationState?.zSlice ?? 0}
            />
            <ROIDrawingOverlay
                viewState={currentViewState}
                containerSize={containerDimensions}
                drawingPoints={drawingPoints}
                cursorPosition={cursorPosition}
                isDrawing={isDrawing}
            />
            {showNamePrompt && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-4 shadow-xl max-w-xs w-full mx-4">
                        <div className="text-sm font-medium mb-2">Name this ROI</div>
                        <input
                            type="text"
                            value={pendingROIName}
                            onChange={e => setPendingROIName(e.target.value)}
                            placeholder="ROI name..."
                            autoFocus
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                            onKeyDown={e => e.key === 'Enter' && handleFinishROI()}
                        />
                        <div className="flex gap-2 mt-3">
                            <button onClick={handleFinishROI} className="flex-1 px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">Save</button>
                            <button onClick={() => setShowNamePrompt(false)} className="px-3 py-2 text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default VivViewerWrapper;