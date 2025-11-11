import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import * as zarrita from 'zarrita'
import {
    OverviewView,
    DetailView,
    getDefaultInitialViewState,
    OVERVIEW_VIEW_ID,
    DETAIL_VIEW_ID,
} from '@hms-dbmi/viv'

import ZarrPixelSource from '../ext/ZarrPixelSource'
import { FrameView, FRAME_VIEW_ID } from '../../components/viewer2D/zarr/map/FrameView'
import { useResizeObserver } from './useResizeObserver'
import { useViewer2DData } from '../contexts/Viewer2DDataContext'

import type * as viv from "@vivjs/types"
import type { Layer, View } from 'deck.gl'
import type {
    VivViewState, VivDetailViewState,
    VivViewerState, VivViewerComputed, VivViewerActions, VivLayerProps
} from '../../types/viewer2D/vivViewer'
import type { NavigationState } from '../../types/viewer2D/navState'
import type { IMultiscaleInfo } from '../../types/metadata/loader'


export default function useVivViewer(
    msInfo: IMultiscaleInfo,
    navigationState: NavigationState,
    root: zarrita.Location<zarrita.FetchStore> | null
): VivViewerState & VivViewerComputed & VivViewerActions {

    const { setVivViewState } = useViewer2DData();

    // Core state
    const [vivLoaders, setVivLoaders] = useState<ZarrPixelSource[]>([])
    const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 })
    const [detailViewDrag, setDetailViewDrag] = useState<VivDetailViewState>({
        isDragging: false,
        startPos: [0, 0],
        startTarget: [0, 0, 0]
    })
    const [controlledDetailViewState, setControlledDetailViewState] = useState<VivViewState | null>(null)
    const [isManuallyPanning, setIsManuallyPanning] = useState(false)

    // Refs
    const detailViewStateRef = useRef<VivViewState | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Container dimension management
    const handleResize = useCallback(({ width, height }: { width: number; height: number }) => {
        setContainerDimensions({
            width: Math.max(width, 400),
            height: Math.max(height, 400)
        })
    }, [])

    // Use shared resize observer hook with stable callback
    useResizeObserver(containerRef as React.RefObject<HTMLElement>, handleResize)

    // Load Viv loaders for all resolution levels
    useEffect(() => {
        async function loadAllResolutions() {
            if (!root || !msInfo) {
                setVivLoaders([])
                return
            }

            const allLoaders: ZarrPixelSource[] = []

            for (const resolutionPath of msInfo.resolutions) {
                try {
                    const resolutionArray =
                        await zarrita.open(root.resolve(resolutionPath)) as zarrita.Array<typeof msInfo.dtype>
                    const loader = new ZarrPixelSource(resolutionArray, {
                        labels: ['t', 'c', 'z', 'y', 'x'].filter(
                            key => Object.keys(msInfo.shape).includes(key)
                        ) as viv.Properties<string[]>,
                        tileSize: resolutionArray.chunks.at(-1)!
                    })
                    allLoaders.push(loader)
                } catch (error) {
                    console.error(`Failed to load resolution at ${resolutionPath}:`, error)
                }
            }
            setVivLoaders(allLoaders)
        }

        loadAllResolutions()
    }, [msInfo, root])

    // Compute selections based on navigation state
    // Each selection corresponds to a rendered layer for a specific channel
    const selections = useMemo(() => {
        if (!navigationState.channelMap) {
            console.log("No channel map available, returning empty selections")
            return []
        }

        const shape = msInfo.shape
        const channelMap = navigationState.channelMap
        
        // Create a selection for each mapped channel (nucleus, cytoplasm, etc.)
        const roleSelections = Object.entries(channelMap)
            .filter(entry => entry[1] !== null)
            .map(([role, channelIndex]) => {
                const selection: Record<string, number> = {
                    c: channelIndex as number  // Select the specific channel for this role
                }
                if (shape.z && shape.z >= 0) {
                    selection.z = navigationState.zSlice
                }
                if (shape.t && shape.t >= 0) {
                    selection.t = navigationState.timeSlice
                }
                return selection
            })
        
        return roleSelections.length > 0 ? roleSelections : []
    }, [navigationState, msInfo.shape])

    // Generate colors based on channel map
    // Return one color per selected channel, in the order they appear in channelMap
    const colors = useMemo(() => {
        // Default color palette for rendering roles
        const defaultColors = [
            [0, 255, 0],    // Nucleus (green)
            [255, 0, 0],    // Cytoplasm (red)
        ]

        if (!navigationState.channelMap) {
            console.log("Using default color")
            return [defaultColors[0]]
        }

        const channelMap = navigationState.channelMap
        
        // Create colors array with one entry per mapped (non-null) channel, in role order
        const roleColors = Object.entries(channelMap)
            .filter(entry => entry[1] !== null)
            .map(([role, channelIndex], roleIndex) => {
                // Use the corresponding color from defaultColors, cycling if needed
                return defaultColors[roleIndex % defaultColors.length]
            })
        
        return roleColors.length > 0 ? roleColors : [defaultColors[0]]
    }, [navigationState.channelMap])

    // Overview configuration
    const overview = useMemo(() => ({
        height: Math.min(120, Math.floor(containerDimensions.height * 0.2)),
        width: Math.min(120, Math.floor(containerDimensions.width * 0.2)),
        zoom: -3,
        backgroundColor: [0, 0, 0]
    }), [containerDimensions])

    // Generate view instances
    const views = useMemo(() => {
        if (vivLoaders.length === 0) {
            return []
        }

        const detailView = new DetailView({
            id: DETAIL_VIEW_ID,
            height: containerDimensions.height,
            width: containerDimensions.width
        })

        const overviewView = new OverviewView({
            id: OVERVIEW_VIEW_ID,
            loader: vivLoaders,
            detailHeight: containerDimensions.height,
            detailWidth: containerDimensions.width
        })

        const frameView = new FrameView({
            id: FRAME_VIEW_ID,
            x: 0,
            y: 0,
            height: containerDimensions.height,
            width: containerDimensions.width
        })

        return [detailView, frameView, overviewView]
    }, [vivLoaders, containerDimensions])

    // Generate view states
    const viewStates = useMemo(() => {
        if (vivLoaders.length === 0 || views.length === 0) {
            return []
        }

        const overviewState = getDefaultInitialViewState(vivLoaders, overview, 0.5) as VivViewState
        const detailState = controlledDetailViewState
            || getDefaultInitialViewState(vivLoaders, containerDimensions, 0) as VivViewState

        return [
            { ...detailState, id: DETAIL_VIEW_ID },
            { ...detailState, id: FRAME_VIEW_ID }, // Frame follows detail view state
            { ...overviewState, id: OVERVIEW_VIEW_ID }
        ]
    }, [vivLoaders, views, overview, containerDimensions, controlledDetailViewState])

    // Generate layer props
    const createLayerProps = useCallback((frameOverlayLayers: Layer[] = []) => {
        if (vivLoaders.length === 0 || views.length === 0 || !msInfo.shape.c) {
            return []
        }

        // Get max value for dtype to use for full-range contrast limits
        const getMaxValueForDtype = (dtype: string): number => {
            switch (dtype) {
                case 'uint8': return 255;
                case 'uint16': return 65535;
                case 'uint32': return 4294967295;
                case 'float32':
                case 'float64': return 1.0;
                default: return 65535;
            }
        };

        const maxValue = getMaxValueForDtype(msInfo.dtype);

        // Create contrast limits array with one entry per selected channel, in role order
        const contrastLimits = Object.entries(navigationState.channelMap)
            .filter(entry => entry[1] !== null)
            .map(([role, channelIndex], roleIndex) => {
                // Use the contrast limit for this role (stored by index in contrastLimits array)
                return [0, navigationState.contrastLimits[roleIndex]] as [number, number]
            })

        // All selected channels are visible (we only render them because selections filters)
        const channelsVisible = Array.from(
            { length: Object.values(navigationState.channelMap).filter(c => c !== null).length },
            () => true
        )

        const baseProps = {
            loader: vivLoaders,
            selections,
            colors,
            contrastLimits,
            channelsVisible
        }

        // Return layer props for each view in the same order as views array
        return views.map((view) => {
            if (view.id === FRAME_VIEW_ID) {
                // Frame view gets the overlay layers
                return { ...baseProps, frameOverlayLayers }
            }
            return baseProps
        })
    }, [vivLoaders, views, selections, colors, navigationState.channelMap, navigationState.contrastLimits, msInfo.shape.c, msInfo.dtype])

    // Generate default layer props (for initial render)
    const layerProps = useMemo(() => createLayerProps([]), [createLayerProps])

    // Handle view state changes
    const handleViewStateChange = useCallback(({ viewId, viewState }: {
        viewId: string
        viewState: VivViewState
        oldViewState: VivViewState
    }) => {
        if (viewId === DETAIL_VIEW_ID) {
            // Always update the ref to track current state
            detailViewStateRef.current = viewState
            setVivViewState(viewState);

            // Only update controlled state if we're not manually panning to avoid feedback loop
            if (!isManuallyPanning) {
                setControlledDetailViewState(viewState)
            }
        }
    }, [isManuallyPanning, setVivViewState])

    return {
        // State
        vivLoaders,
        containerDimensions,
        detailViewDrag,
        controlledDetailViewState,
        isManuallyPanning,
        detailViewStateRef,
        containerRef,

        // Computed values
        selections,
        colors,
        overview,
        views,
        viewStates,
        layerProps,

        // Actions
        setContainerDimensions,
        setDetailViewDrag,
        setControlledDetailViewState,
        setIsManuallyPanning,
        handleViewStateChange,
        createLayerProps
    }
}