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
    setControlledDetailViewState: (state: VivViewState | null) => void,
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
    } = useViewer2DData();

    const { msInfo } = useZarrStore();
    const { selectedROI } = useROI();

    const {
        selectedNucleiIndices,
        addSelectedNucleus,
        removeSelectedNucleus,
        setSelectedNucleiIndices,
        clearSelection,
    } = useNucleusSelection();

    const [frameInteraction, setFrameInteraction] = useState<FrameInteractionState>({
        isDragging: false,
        dragMode: 'none',
        startPos: [0, 0],
        startFrameCenter: [0, 0],
        startFrameSize: [0, 0]
    })
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)

    const [tempFrameCenter, setTempFrameCenter] = useState<[number, number] | null>(null)
    const [tempFrameSize, setTempFrameSize] = useState<[number, number] | null>(null)

    const [selectionBox, setSelectionBox] = useState<{
        isDragging: boolean,
        startPos: [number, number],
        currentPos: [number, number]
    }>({
        isDragging: false,
        startPos: [0, 0],
        currentPos: [0, 0]
    })

    const handleFrameInteraction = useCallback((info: PickingInfo) => {
        if (!info || !info.object) {
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
    }, [frameCenter, frameSize]);

    const handleHover = useCallback((info: PickingInfo) => {
        if (!frameInteraction.isDragging && info.object && info.object.type && info.object.type.startsWith('resize-') && info.layer && info.layer.id && info.layer.id.includes('handle')) {
            setHoveredHandle(info.object.type);
        } else if (!frameInteraction.isDragging) {
            if (hoveredHandle !== null) {
                setHoveredHandle(null);
            }
        }
    }, [frameInteraction.isDragging, hoveredHandle]);

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

            setTempFrameCenter(result.center);
            setTempFrameSize(result.size);
            return true;
        }
        return false;
    }, [frameInteraction]);

    const handleDragEnd = useCallback(() => {
        if (frameInteraction.isDragging) {
            if (tempFrameCenter !== null) {
                setFrameCenter(tempFrameCenter);
            }
            if (tempFrameSize !== null) {
                setFrameSize(tempFrameSize);
            }

            setTempFrameCenter(null);
            setTempFrameSize(null);

            setFrameInteraction({
                isDragging: false,
                dragMode: 'none',
                startPos: [0, 0],
                startFrameCenter: [0, 0],
                startFrameSize: [200, 200]
            });
            return true;
        }
        return false;
    }, [frameInteraction.isDragging, tempFrameCenter, tempFrameSize, setFrameCenter, setFrameSize]);

    const handleClick = useCallback((info: PickingInfo) => {
        if (info.layer && info.viewport?.id === FRAME_VIEW_ID && info.object) {
            if ((info.layer.id.includes('handle') && info.object.type?.startsWith('resize-')) ||
                (info.layer.id.includes('move-area') && info.object.type === 'move')) {
                const handled = handleFrameInteraction(info);
                if (handled) {
                    return true;
                }
            }
        }
        return false;
    }, [handleFrameInteraction]);

    const getCursor = useCallback((info: PickingInfo) => {
        if (frameInteraction.isDragging) {
            return getCursorForDragMode(frameInteraction.dragMode);
        }
        if (hoveredHandle && hoveredHandle.startsWith('resize-')) {
            return getCursorForDragMode(hoveredHandle as DragMode);
        }
        if (info && info.object && info.object.type === 'move' && info.layer && info.layer.id.includes('move-area')) {
            return 'move';
        }
        if (info && info.viewport?.id === FRAME_VIEW_ID && !info.layer) {
            return 'grab';
        }
        return 'default';
    }, [frameInteraction.isDragging, hoveredHandle]);

    const frameOverlayLayers = useMemo(() => {
        if (!msInfo) {
            return [];
        }

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
            hoveredHandle,
            polygonPoints: selectedROI?.points
        });
    }, [msInfo, frameCenter, frameSize, tempFrameCenter, tempFrameSize, hoveredHandle, selectedROI]);

    const handleSelectionBoxAreaSelection = useCallback((startCoord: [number, number], endCoord: [number, number]) => {
        if (!frameBoundCellposeData || !navigationState) return;

        const frameStartX = Math.floor(frameCenter[0] - frameSize[0] / 2);
        const frameStartY = Math.floor(frameCenter[1] - frameSize[1] / 2);

        const minX = Math.min(startCoord[0], endCoord[0]) - frameStartX;
        const maxX = Math.max(startCoord[0], endCoord[0]) - frameStartX;
        const minY = Math.min(startCoord[1], endCoord[1]) - frameStartY;
        const maxY = Math.max(startCoord[1], endCoord[1]) - frameStartY;

        const { data, shape } = frameBoundCellposeData;
        if (!shape || shape.length < 3) return;

        const [zCount, height, width] = shape;
        const { zSlice } = navigationState;
        const startZ = Math.max(0, zSlice - frameZLayersBelow);
        const zIndexInChunk = zSlice - startZ;

        if (zIndexInChunk < 0 || zIndexInChunk >= zCount) return;

        const selectedNuclei = new Set<number>();

        for (let y = Math.max(0, Math.floor(minY)); y < Math.min(height, Math.ceil(maxY)); y++) {
            for (let x = Math.max(0, Math.floor(minX)); x < Math.min(width, Math.ceil(maxX)); x++) {
                const index = zIndexInChunk * height * width + y * width + x;
                const nucleusIndex = (data as any)[index];

                if (nucleusIndex > 0) {
                    selectedNuclei.add(nucleusIndex);
                }
            }
        }

        setSelectedNucleiIndices(Array.from(selectedNuclei));
    }, [frameBoundCellposeData, navigationState, frameCenter, frameSize, frameZLayersAbove, frameZLayersBelow, setSelectedNucleiIndices]);

    const onDragStart = useCallback((info: PickingInfo) => {
        if (info.layer && info.object) {
            if ((info.layer.id.includes('handle') && info.object.type?.startsWith('resize-'))
                || (info.layer.id.includes('move-area') && info.object.type === 'move')) {
                const handled = handleFrameInteraction(info);
                if (handled) {
                    return true;
                }
            }
        }

        if (info.coordinate && info.viewport?.id === DETAIL_VIEW_ID) {
            const originalEvent = (info as any).srcEvent || (info as any).originalEvent;
            if (originalEvent && originalEvent.shiftKey) {
                setSelectionBox({
                    isDragging: true,
                    startPos: [info.coordinate[0], info.coordinate[1]],
                    currentPos: [info.coordinate[0], info.coordinate[1]]
                });
                return true;
            }
        }

        return false;
    }, [handleFrameInteraction]);

    const onDrag = useCallback((info: PickingInfo) => {
        const frameHandled = handleDrag(info);
        if (frameHandled) {
            return true;
        }

        if (selectionBox.isDragging && info.coordinate) {
            setSelectionBox(prev => ({
                ...prev,
                currentPos: [info.coordinate![0], info.coordinate![1]]
            }));
            return true;
        }

        return false;
    }, [handleDrag, selectionBox.isDragging]);

    const onDragEnd = useCallback(() => {
        const frameHandled = handleDragEnd();
        if (frameHandled) {
            return true;
        }

        if (selectionBox.isDragging) {
            handleSelectionBoxAreaSelection(selectionBox.startPos, selectionBox.currentPos);

            setSelectionBox({
                isDragging: false,
                startPos: [0, 0],
                currentPos: [0, 0]
            });
            return true;
        }

        return false;
    }, [handleDragEnd, selectionBox, handleSelectionBoxAreaSelection]);

    const onClick = useCallback((info: PickingInfo) => {
        const frameHandled = handleClick(info);
        if (frameHandled) {
            return true;
        }

        if (info.viewport && info.viewport.id === OVERVIEW_VIEW_ID && info.coordinate) {
            const [x, y] = info.coordinate;
            setFrameCenter([x, y]);
            return true;
        }

        if (info.viewport && info.viewport.id === DETAIL_VIEW_ID && info.coordinate && frameBoundCellposeData && navigationState) {
            const [clickX, clickY] = info.coordinate;

            const frameStartX = Math.floor(frameCenter[0] - frameSize[0] / 2);
            const frameStartY = Math.floor(frameCenter[1] - frameSize[1] / 2);

            const localX = Math.floor(clickX - frameStartX);
            const localY = Math.floor(clickY - frameStartY);

            const { data, shape } = frameBoundCellposeData;
            if (!shape || shape.length < 3) return false;

            const [zCount, height, width] = shape;
            const { zSlice } = navigationState;
            const startZ = Math.max(0, zSlice - frameZLayersBelow);
            const zIndexInChunk = zSlice - startZ;

            if (
                localX >= 0 && localX < width &&
                localY >= 0 && localY < height &&
                zIndexInChunk >= 0 && zIndexInChunk < zCount
            ) {
                const index = zIndexInChunk * height * width + localY * width + localX;
                const nucleusIndex = (data as any)[index];

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
        }

        return false;
    }, [
        handleClick, setFrameCenter, frameBoundCellposeData, frameCenter,
        frameSize, navigationState, frameZLayersAbove, frameZLayersBelow, selectedNucleiIndices,
        addSelectedNucleus, removeSelectedNucleus, clearSelection, setSelectedNucleiIndices
    ]);


    return {
        frameInteraction,
        hoveredHandle,
        handleHover,
        getCursor,
        frameOverlayLayers,
        selectionBox,
        onDragStart,
        onDrag,
        onDragEnd,
        onClick,
    };
}