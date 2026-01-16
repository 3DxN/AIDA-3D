import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { OVERVIEW_VIEW_ID, DETAIL_VIEW_ID } from '@hms-dbmi/viv'

import {
    getCursorForDragMode,
    calculateFrameResize,
    createFrameOverlayLayers,
    FRAME_VIEW_ID
} from '../../components/viewer2D/zarr/map/FrameView'
import { useViewer2DData } from '../contexts/Viewer2DDataContext'
import { useNucleusSelection } from '../contexts/NucleusSelectionContext'
import { useZarrStore } from '../contexts/ZarrStoreContext'
import { useROI } from '../contexts/ROIContext'


import type { PickingInfo } from 'deck.gl'
import type { DragMode, FrameInteractionState } from '../../types/viewer2D/frame'
import type { IMultiscaleInfo } from '../../types/metadata/loader'
import { VivDetailViewState, VivViewState } from '../../types/viewer2D/vivViewer'
import { NavigationState } from '../../types/viewer2D/navState'


/**
 * Hook function to manage frame interaction state in the viewer.
 * Handles dragging, resizing, and interaction with frame handles.
 */
export function useFrameInteraction(
    detailViewStateRef: React.RefObject<VivViewState | null>,
    setIsManuallyPanning: (panning: boolean) => void,
    setDetailViewDrag: (drag: VivDetailViewState) => void,
    detailViewDrag: VivDetailViewState,
    setControlledDetailViewState: (state: VivViewState) => void,
    setShowLabelModal: (show: boolean) => void,
) {
    const {
        frameCenter,
        frameSize,
        frameZLayersAbove,
        frameZLayersBelow,
        setFrameCenter,
        setFrameSize,
        frameBoundCellposeData,
        navigationState,
        full3DMode,
    } = useViewer2DData();

    const { msInfo } = useZarrStore();

    const {
        selectedNucleiIndices,
        addSelectedNucleus,
        removeSelectedNucleus,
        setSelectedNucleiIndices,
        clearSelection,
    } = useNucleusSelection();

    const {
        drawingState,
        addVertex,
        updatePreviewVertex,
    } = useROI();

    const [frameInteraction, setFrameInteraction] = useState<FrameInteractionState>({
        isDragging: false,
        dragMode: 'none',
        startPos: [0, 0],
        startFrameCenter: [0, 0],
        startFrameSize: [0, 0]
    })
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)

    // Temporary frame state during dragging (doesn't trigger cellpose updates)
    const [tempFrameCenter, setTempFrameCenter] = useState<[number, number] | null>(null)
    const [tempFrameSize, setTempFrameSize] = useState<[number, number] | null>(null)

    // Context selection box state
    const [selectionBox, setSelectionBox] = useState<{
        isDragging: boolean,
        startPos: [number, number],
        currentPos: [number, number]
    }>({
        isDragging: false,
        startPos: [0, 0],
        currentPos: [0, 0]
    })

    // Handle frame interactions (handles and move area are pickable)
    // Disabled in Full 3D Mode as the frame is not shown
    const handleFrameInteraction = useCallback((info: PickingInfo) => {
        // Disable frame interaction in Full 3D Mode
        if (full3DMode) {
            return false;
        }

        if (!info || !info.object) {
            console.log('No interaction info or object, returning false');
            return false;
        }

        const layerType = info.object.type;
        if (layerType && layerType.startsWith('resize-')) {
            setFrameInteraction({
                isDragging: true,
                dragMode: layerType as DragMode,
                startPos: [info.coordinate![0], info.coordinate![1]],
                startFrameCenter: [...frameCenter],
                startFrameSize: [...frameSize]
            });
            return true;
        }
        if (layerType === 'move') {
            setFrameInteraction({
                isDragging: true,
                dragMode: 'move',
                startPos: [info.coordinate![0], info.coordinate![1]],
                startFrameCenter: [...frameCenter],
                startFrameSize: [...frameSize]
            });
            return true;
        }
        return false;
    }, [full3DMode, frameCenter, frameSize]);

    // Handle DeckGL hover events for visual feedback only
    const handleHover = useCallback((info: PickingInfo) => {
        // Update ROI preview vertex when in drawing mode
        // Accept hover from both DETAIL_VIEW_ID and FRAME_VIEW_ID (the frame area where segmentation is shown)
        const isDrawingViewport = info.viewport?.id === DETAIL_VIEW_ID || info.viewport?.id === FRAME_VIEW_ID;
        if (drawingState.isDrawing && info.coordinate && isDrawingViewport) {
            updatePreviewVertex({ x: info.coordinate[0], y: info.coordinate[1] });
        } else if (drawingState.isDrawing) {
            updatePreviewVertex(null);
        }

        // Only update hover state for handles (only handles are pickable now)
        if (!frameInteraction.isDragging && info.object && info.object.type && info.object.type.startsWith('resize-') && info.layer && info.layer.id && info.layer.id.includes('handle')) {
            setHoveredHandle(info.object.type);
        } else if (!frameInteraction.isDragging) {
            // Clear hover when not over any handle - this includes moving from handle to frame area
            if (hoveredHandle !== null) {
                setHoveredHandle(null);
            }
        }
    }, [frameInteraction.isDragging, hoveredHandle, drawingState.isDrawing, updatePreviewVertex]);

    // Handle drag events for frame resizing/moving (use temp state to avoid cellpose updates)
    const handleDrag = useCallback((info: PickingInfo) => {
        if (frameInteraction.isDragging && info.coordinate) {
            const [currentX, currentY] = info.coordinate;
            const [startX, startY] = frameInteraction.startPos;

            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            const result = calculateFrameResize(
                frameInteraction.dragMode,
                frameInteraction.startFrameCenter,
                frameInteraction.startFrameSize,
                deltaX,
                deltaY
            );

            // Update temporary state during drag (doesn't trigger cellpose context update)
            setTempFrameCenter(result.center);
            setTempFrameSize(result.size);
            return true; // Stop propagation
        }
        return false;
    }, [frameInteraction]);

    // Handle drag end events (commit changes to actual state to trigger cellpose updates)
    const handleDragEnd = useCallback(() => {
        if (frameInteraction.isDragging) {
            // Commit the temporary frame state to the actual state (triggers cellpose context update)
            if (tempFrameCenter !== null) {
                setFrameCenter(tempFrameCenter);
            }
            if (tempFrameSize !== null) {
                setFrameSize(tempFrameSize);
            }

            // Clear temporary state
            setTempFrameCenter(null);
            setTempFrameSize(null);

            setFrameInteraction({
                isDragging: false,
                dragMode: 'none',
                startPos: [0, 0],
                startFrameCenter: [0, 0],
                startFrameSize: [200, 200]
            });
            return true; // Stop propagation
        }
        return false;
    }, [frameInteraction.isDragging, tempFrameCenter, tempFrameSize, setFrameCenter, setFrameSize]);

    // Handle click events for frame interactions
    // Note: Only intercept clicks on resize handles, NOT the move area
    // Clicks on move area should fall through to nucleus selection
    const handleClick = useCallback((info: PickingInfo) => {
        // Only intercept events that hit resize handles (not move area - that's for dragging only)
        if (info.layer && info.viewport?.id === FRAME_VIEW_ID && info.object) {
            if (info.layer.id.includes('handle') && info.object.type?.startsWith('resize-')) {
                const handled = handleFrameInteraction(info);
                if (handled) {
                    return true; // Stop propagation - we're handling this
                }
            }
        }
        return false;
    }, [handleFrameInteraction]);

    // Get cursor style based on current interaction state
    const getCursor = useCallback((info: PickingInfo) => {
        if (frameInteraction.isDragging) {
            return getCursorForDragMode(frameInteraction.dragMode);
        }
        if (hoveredHandle && hoveredHandle.startsWith('resize-')) {
            return getCursorForDragMode(hoveredHandle as DragMode);
        }
        // Check if we're hovering over the frame move area
        if (info && info.object && info.object.type === 'move' && info.layer && info.layer.id.includes('move-area')) {
            return 'move';
        }
        // Show grab cursor when over frame view but not over any interactive elements
        if (info && info.viewport?.id === FRAME_VIEW_ID && !info.layer) {
            return 'grab';
        }
        return 'default';
    }, [frameInteraction.isDragging, hoveredHandle]);

    // Create interactive frame overlay layers (use temp state when dragging, actual state otherwise)
    // In Full 3D Mode: hide frame overlay as the entire volume is loaded
    const frameOverlayLayers = useMemo(() => {
        // No frame overlay in Full 3D Mode or if msInfo is not loaded
        if (full3DMode || !msInfo) {
            return [];
        }

        // Use temporary frame state if dragging, otherwise use actual state
        const currentFrameCenter = tempFrameCenter ?? frameCenter;
        const currentFrameSize = tempFrameSize ?? frameSize;

        return createFrameOverlayLayers(currentFrameCenter, currentFrameSize, FRAME_VIEW_ID, {
            fillColor: [0, 0, 0, 0] as [number, number, number, number],
            lineColor: [255, 255, 255, 255] as [number, number, number, number],
            lineWidth: 3,
            filled: false,
            stroked: true,
            showHandles: true,
            handleSize: 8,
            hoveredHandle
        });
    }, [full3DMode, msInfo, frameCenter, frameSize, tempFrameCenter, tempFrameSize, hoveredHandle]);

    // Handle selection box area selection
    const handleSelectionBoxAreaSelection = useCallback((startCoord: [number, number], endCoord: [number, number]) => {
        if (!frameBoundCellposeData || !navigationState) return;

        // In Full 3D Mode: use full image dimensions; otherwise use frame bounds
        const effectiveFrameSize: [number, number] = full3DMode && msInfo?.shape.x && msInfo?.shape.y
            ? [msInfo.shape.x, msInfo.shape.y]
            : frameSize;
        const effectiveFrameCenter: [number, number] = full3DMode && msInfo?.shape.x && msInfo?.shape.y
            ? [msInfo.shape.x / 2, msInfo.shape.y / 2]
            : frameCenter;

        const frameStartX = Math.floor(effectiveFrameCenter[0] - effectiveFrameSize[0] / 2);
        const frameStartY = Math.floor(effectiveFrameCenter[1] - effectiveFrameSize[1] / 2);

        // Convert screen coordinates to frame-relative coordinates
        const minX = Math.min(startCoord[0], endCoord[0]) - frameStartX;
        const maxX = Math.max(startCoord[0], endCoord[0]) - frameStartX;
        const minY = Math.min(startCoord[1], endCoord[1]) - frameStartY;
        const maxY = Math.max(startCoord[1], endCoord[1]) - frameStartY;

        const { data, shape } = frameBoundCellposeData;
        if (!shape || shape.length < 2) return;

        const selectedNuclei = new Set<number>();

        if (shape.length === 2) {
            // 2D data: [height, width]
            const [height, width] = shape;

            // Iterate through the selection box area
            for (let y = Math.max(0, Math.floor(minY)); y < Math.min(height, Math.ceil(maxY)); y++) {
                for (let x = Math.max(0, Math.floor(minX)); x < Math.min(width, Math.ceil(maxX)); x++) {
                    const index = y * width + x;
                    const nucleusIndex = (data as any)[index];

                    if (nucleusIndex > 0) {
                        selectedNuclei.add(nucleusIndex);
                    }
                }
            }
        } else {
            // 3D data: [z, height, width]
            const [zCount, height, width] = shape;
            const { zSlice } = navigationState;
            const startZ = Math.max(0, zSlice - frameZLayersBelow);
            const zIndexInChunk = zSlice - startZ;

            if (zIndexInChunk < 0 || zIndexInChunk >= zCount) return;

            // Iterate through the selection box area
            for (let y = Math.max(0, Math.floor(minY)); y < Math.min(height, Math.ceil(maxY)); y++) {
                for (let x = Math.max(0, Math.floor(minX)); x < Math.min(width, Math.ceil(maxX)); x++) {
                    const index = zIndexInChunk * height * width + y * width + x;
                    const nucleusIndex = (data as any)[index];

                    if (nucleusIndex > 0) {
                        selectedNuclei.add(nucleusIndex);
                    }
                }
            }
        }

        // Update selection
        setSelectedNucleiIndices(Array.from(selectedNuclei));
    }, [frameBoundCellposeData, navigationState, frameCenter, frameSize, frameZLayersBelow, setSelectedNucleiIndices, full3DMode, msInfo]);

    // Complete onDragStart handler combining frame and view interactions
    const onDragStart = useCallback((info: PickingInfo) => {
        // Handle frame interactions first (highest priority)
        if (info.layer && info.object) {
            if ((info.layer.id.includes('handle') && info.object.type?.startsWith('resize-'))
                || (info.layer.id.includes('move-area') && info.object.type === 'move')) {
                const handled = handleFrameInteraction(info);
                if (handled) {
                    return true; // Stop propagation - we're handling this
                }
            }
        }

        // Check if we should start selection box (when shift is held and in detail view)
        if (info.coordinate && info.viewport?.id === DETAIL_VIEW_ID) {
            // Access original event through the event property of the info object
            const originalEvent = (info as any).srcEvent || (info as any).originalEvent;
            if (originalEvent && originalEvent.shiftKey) {
                setSelectionBox({
                    isDragging: true,
                    startPos: [info.coordinate[0], info.coordinate[1]],
                    currentPos: [info.coordinate[0], info.coordinate[1]]
                });
                return true; // Stop propagation - we're handling selection
            }
        }

        // For any drag that's not a frame interaction, start manual panning
        // This works regardless of which viewport the event comes from
        if (info.coordinate && detailViewStateRef.current) {
            setIsManuallyPanning(true);
            setDetailViewDrag({
                isDragging: true,
                startPos: [info.coordinate[0], info.coordinate[1]],
                startTarget: [
                    detailViewStateRef.current.target[0],
                    detailViewStateRef.current.target[1],
                    detailViewStateRef.current.target[2]
                ]
            });
            return true; // We'll handle this manually
        }

        // Fallback - let default behavior handle it
        return false;
    }, [handleFrameInteraction, detailViewStateRef, setIsManuallyPanning, setDetailViewDrag]);

    // Complete onDrag handler combining frame and view interactions
    const onDrag = useCallback((info: PickingInfo) => {
        // Handle frame drag first
        const frameHandled = handleDrag(info);
        if (frameHandled) {
            return true;
        }

        // Handle selection box dragging
        if (selectionBox.isDragging && info.coordinate) {
            setSelectionBox(prev => ({
                ...prev,
                currentPos: [info.coordinate![0], info.coordinate![1]]
            }));
            return true; // Stop propagation
        }

        // Handle manual detail view panning
        if (detailViewDrag.isDragging && info.coordinate) {
            const [currentX, currentY] = info.coordinate;
            const [startX, startY] = detailViewDrag.startPos;

            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            // Calculate new target position
            const newTarget = [
                detailViewDrag.startTarget[0] - deltaX,
                detailViewDrag.startTarget[1] - deltaY,
                detailViewDrag.startTarget[2]
            ];

            // Update controlled state to trigger view update
            const newViewState = {
                ...detailViewStateRef.current,
                target: newTarget
            } as VivViewState;

            detailViewStateRef.current = newViewState;
            setControlledDetailViewState(newViewState);

            return true; // Stop propagation
        }

        return false; // Allow default behavior
    }, [handleDrag, detailViewDrag, detailViewStateRef, setControlledDetailViewState, selectionBox.isDragging]);

    // Complete onDragEnd handler combining frame and view interactions
    const onDragEnd = useCallback(() => {
        // Handle frame drag end first
        const frameHandled = handleDragEnd();
        if (frameHandled) {
            return true;
        }

        // Handle selection box end
        if (selectionBox.isDragging) {
            // Perform the selection based on the final box area
            handleSelectionBoxAreaSelection(selectionBox.startPos, selectionBox.currentPos);

            // Reset selection box state
            setSelectionBox({
                isDragging: false,
                startPos: [0, 0],
                currentPos: [0, 0]
            });
            return true; // Stop propagation
        }

        if (detailViewDrag.isDragging) {
            setIsManuallyPanning(false);
            setDetailViewDrag({
                isDragging: false,
                startPos: [0, 0],
                startTarget: [0, 0, 0]
            });
            return true; // Stop propagation
        }

        return false; // Allow default behavior
    }, [handleDragEnd, detailViewDrag, setIsManuallyPanning, setDetailViewDrag, selectionBox, handleSelectionBoxAreaSelection]);

    // Complete onClick handler combining frame and overview interactions
    const onClick = useCallback((info: PickingInfo) => {
        // ROI Drawing Mode - intercept clicks when drawing
        // Accept clicks from both DETAIL_VIEW_ID and FRAME_VIEW_ID (the frame area where segmentation is shown)
        const isDrawingViewport = info.viewport?.id === DETAIL_VIEW_ID || info.viewport?.id === FRAME_VIEW_ID;
        if (drawingState.isDrawing && info.coordinate && isDrawingViewport) {
            const [clickX, clickY] = info.coordinate;
            const newVertex = { x: clickX, y: clickY };

            // Check if clicking near first vertex to close polygon (need at least 3 vertices)
            if (drawingState.currentVertices.length >= 3) {
                const firstVertex = drawingState.currentVertices[0];
                const distance = Math.sqrt(
                    Math.pow(clickX - firstVertex.x, 2) + Math.pow(clickY - firstVertex.y, 2)
                );

                // Use a threshold that scales with zoom (smaller threshold when zoomed in)
                const zoom = detailViewStateRef.current?.zoom ?? 0;
                const threshold = 15 / Math.pow(2, zoom); // ~15 pixels at zoom 0

                if (distance < threshold) {
                    // Close polygon - trigger label modal
                    setShowLabelModal(true);
                    return true;
                }
            }

            // Otherwise, add the vertex
            addVertex(newVertex);
            return true;
        }

        const frameHandled = handleClick(info);
        if (frameHandled) {
            return true;
        }

        if (info.viewport && info.viewport.id === OVERVIEW_VIEW_ID && info.coordinate) {
            const [x, y] = info.coordinate;
            setFrameCenter([x, y]);
            return true;
        }

        // Allow nucleus selection from both DETAIL_VIEW_ID and FRAME_VIEW_ID (frame overlays the detail view)
        if (info.viewport && (info.viewport.id === DETAIL_VIEW_ID || info.viewport.id === FRAME_VIEW_ID) && info.coordinate && frameBoundCellposeData && navigationState) {
            const [clickX, clickY] = info.coordinate;

            // In Full 3D Mode: use full image dimensions; otherwise use frame bounds
            const effectiveFrameSize: [number, number] = full3DMode && msInfo?.shape.x && msInfo?.shape.y
                ? [msInfo.shape.x, msInfo.shape.y]
                : frameSize;
            const effectiveFrameCenter: [number, number] = full3DMode && msInfo?.shape.x && msInfo?.shape.y
                ? [msInfo.shape.x / 2, msInfo.shape.y / 2]
                : frameCenter;

            const frameStartX = Math.floor(effectiveFrameCenter[0] - effectiveFrameSize[0] / 2);
            const frameStartY = Math.floor(effectiveFrameCenter[1] - effectiveFrameSize[1] / 2);

            const localX = Math.floor(clickX - frameStartX);
            const localY = Math.floor(clickY - frameStartY);

            const { data, shape } = frameBoundCellposeData;
            if (!shape || shape.length < 2) return false;

            // Handle both 2D [height, width] and 3D [z, height, width] data
            let height: number, width: number, nucleusIndex: number;

            if (shape.length === 2) {
                // 2D data: [height, width]
                height = shape[0];
                width = shape[1];

                if (localX >= 0 && localX < width && localY >= 0 && localY < height) {
                    const index = localY * width + localX;
                    nucleusIndex = (data as any)[index];
                } else {
                    return false;
                }
            } else {
                // 3D data: [z, height, width]
                const [zCount, h, w] = shape;
                height = h;
                width = w;
                const { zSlice } = navigationState;
                const startZ = Math.max(0, zSlice - frameZLayersBelow);
                const zIndexInChunk = zSlice - startZ;

                if (
                    localX >= 0 && localX < width &&
                    localY >= 0 && localY < height &&
                    zIndexInChunk >= 0 && zIndexInChunk < zCount
                ) {
                    const index = zIndexInChunk * height * width + localY * width + localX;
                    nucleusIndex = (data as any)[index];
                } else {
                    return false;
                }
            }

            const originalEvent = (info as any).srcEvent || (info as any).originalEvent || {};
            const shiftKey = originalEvent.shiftKey || false;
            const ctrlKey = originalEvent.ctrlKey || false;

            if (nucleusIndex > 0) {
                if (shiftKey) {
                    if (selectedNucleiIndices.includes(nucleusIndex)) {
                        removeSelectedNucleus(nucleusIndex);
                    } else {
                        addSelectedNucleus(nucleusIndex);
                    }
                } else if (ctrlKey) {
                    const lastSelected = selectedNucleiIndices.length > 0 ? selectedNucleiIndices[selectedNucleiIndices.length - 1] : null;
                    const newSelection = [];
                    if (lastSelected !== null) {
                        newSelection.push(lastSelected);
                    }
                    if (nucleusIndex !== lastSelected) {
                        newSelection.push(nucleusIndex);
                    }
                    setSelectedNucleiIndices(newSelection);
                } else {
                    setSelectedNucleiIndices([nucleusIndex]);
                }
            } else {
                if (!shiftKey && !ctrlKey) {
                    clearSelection();
                }
            }
            return true;
        }

        return false;
    }, [
        handleClick, setFrameCenter, frameBoundCellposeData, frameCenter,
        frameSize, navigationState, frameZLayersAbove, frameZLayersBelow, selectedNucleiIndices,
        addSelectedNucleus, removeSelectedNucleus, clearSelection, setSelectedNucleiIndices,
        drawingState.isDrawing, drawingState.currentVertices, addVertex, setShowLabelModal, detailViewStateRef,
        full3DMode, msInfo
    ]);

    // Handle double-click for finishing ROI polygon
    const onDoubleClick = useCallback((info: PickingInfo) => {
        // ROI Drawing Mode - double-click to finish polygon
        if (drawingState.isDrawing && drawingState.currentVertices.length >= 3) {
            setShowLabelModal(true);
            return true;
        }
        return false;
    }, [drawingState.isDrawing, drawingState.currentVertices.length, setShowLabelModal]);


    return {
        frameInteraction,
        hoveredHandle,
        handleHover,
        getCursor,
        frameOverlayLayers,
        selectionBox,
        // Complete deck event handlers
        onDragStart,
        onDrag,
        onDragEnd,
        onClick,
        onDoubleClick,
    };
}