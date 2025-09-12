import React, { useState, useCallback, useMemo } from 'react'
import { OVERVIEW_VIEW_ID } from '@hms-dbmi/viv'
import * as zarrita from 'zarrita'

import {
    getCursorForDragMode,
    calculateFrameResize,
    createFrameOverlayLayers,
    FRAME_VIEW_ID
} from '../../components/viewer2D/zarr/map/FrameView'

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
    frameCenter: [number, number],
    frameSize: [number, number],
    frameZDepth: number,
    setFrameCenter: (center: [number, number]) => void,
    setFrameSize: (size: [number, number]) => void,
    msInfo: IMultiscaleInfo,
    cellposeData: zarrita.Chunk<zarrita.DataType> | null,
    navigationState: NavigationState,
    // Additional dependencies for full deck event handling
    detailViewStateRef: React.RefObject<VivViewState | null>,
    setIsManuallyPanning: (panning: boolean) => void,
    setDetailViewDrag: (drag: VivDetailViewState) => void,
    detailViewDrag: VivDetailViewState,
    setControlledDetailViewState: (state: VivViewState) => void,
) {
    const [frameInteraction, setFrameInteraction] = useState<FrameInteractionState>({
        isDragging: false,
        dragMode: 'none',
        startPos: [0, 0],
        startFrameCenter: [0, 0],
        startFrameSize: [0, 0]
    })
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)

    // Handle frame interactions (handles and move area are pickable)
    const handleFrameInteraction = useCallback((info: PickingInfo) => {
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
    }, [frameCenter, frameSize]);

    // Handle DeckGL hover events for visual feedback only
    const handleHover = useCallback((info: PickingInfo) => {
        // Only update hover state for handles (only handles are pickable now)
        if (!frameInteraction.isDragging && info.object && info.object.type && info.object.type.startsWith('resize-') && info.layer && info.layer.id && info.layer.id.includes('handle')) {
            setHoveredHandle(info.object.type);
        } else if (!frameInteraction.isDragging) {
            // Clear hover when not over any handle - this includes moving from handle to frame area
            if (hoveredHandle !== null) {
                setHoveredHandle(null);
            }
        }
    }, [frameInteraction.isDragging, hoveredHandle]);

    // Handle drag events for frame resizing/moving
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

            setFrameCenter(result.center);
            setFrameSize(result.size);
            return true; // Stop propagation
        }
        return false;
    }, [frameInteraction, setFrameCenter, setFrameSize]);

    // Handle drag end events
    const handleDragEnd = useCallback(() => {
        if (frameInteraction.isDragging) {
            setFrameInteraction({
                isDragging: false,
                dragMode: 'none',
                startPos: [0, 0],
                startFrameCenter: [0, 0],
                startFrameSize: [100, 100]
            });
            return true; // Stop propagation
        }
        return false;
    }, [frameInteraction.isDragging]);

    // Handle click events for frame interactions
    const handleClick = useCallback((info: PickingInfo) => {
        // Only intercept events that hit our specific pickable frame objects
        if (info.layer && info.viewport?.id === FRAME_VIEW_ID && info.object) {
            if ((info.layer.id.includes('handle') && info.object.type?.startsWith('resize-')) ||
                (info.layer.id.includes('move-area') && info.object.type === 'move')) {
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

    // Create interactive frame overlay layers (now only for the frame itself)
    const frameOverlayLayers = useMemo(() => {
        if (!msInfo) {
            return [];
        }

        return createFrameOverlayLayers(frameCenter, frameSize, FRAME_VIEW_ID, {
            fillColor: [0, 0, 0, 0] as [number, number, number, number],
            lineColor: [255, 255, 255, 255] as [number, number, number, number],
            lineWidth: 3,
            filled: false,
            stroked: true,
            showHandles: true,
            handleSize: 8,
            hoveredHandle
        });
    }, [msInfo, frameCenter, frameSize, hoveredHandle]);

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
    }, [handleDrag, detailViewDrag, detailViewStateRef, setControlledDetailViewState]);

    // Complete onDragEnd handler combining frame and view interactions
    const onDragEnd = useCallback(() => {
        // Handle frame drag end first
        const frameHandled = handleDragEnd();
        if (frameHandled) {
            return true;
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
    }, [handleDragEnd, detailViewDrag, setIsManuallyPanning, setDetailViewDrag]);

    // Complete onClick handler combining frame and overview interactions
    const onClick = useCallback((info: PickingInfo) => {
        // Handle frame clicks first
        const frameHandled = handleClick(info);
        if (frameHandled) {
            return true;
        }

        // Handle overview clicks
        if (info.viewport && info.viewport.id === OVERVIEW_VIEW_ID && info.coordinate) {
            const [x, y] = info.coordinate
            setFrameCenter([x, y])
            // Let Viv handle the view state naturally
            return true;
        }

        // For all other cases, let default behavior handle it
        return false;
    }, [handleClick, OVERVIEW_VIEW_ID, setFrameCenter]);

    return {
        frameInteraction,
        setFrameInteraction,
        hoveredHandle,
        setHoveredHandle,
        handleFrameInteraction,
        handleHover,
        handleDrag,
        handleDragEnd,
        handleClick,
        getCursor,
        frameOverlayLayers,
        // Complete deck event handlers
        onDragStart,
        onDrag,
        onDragEnd,
        onClick
    };
}