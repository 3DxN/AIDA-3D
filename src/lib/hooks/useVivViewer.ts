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
    root: zarrita.Location<zarrita.FetchStore> | null,
    controlledDetailViewState: VivViewState | null,
    setControlledDetailViewState: (state: VivViewState | null) => void
): Omit<VivViewerState, 'controlledDetailViewState' | 'isManuallyPanning'> & VivViewerComputed & VivViewerActions {

    const { setVivViewState, setViewerSize, vivViewState } = useViewer2DData();

    const [vivLoaders, setVivLoaders] = useState<ZarrPixelSource[]>([])
    const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 })
    const [detailViewDrag, setDetailViewDrag] = useState<VivDetailViewState>({
        isDragging: false,
        startPos: [0, 0],
        startTarget: [0, 0, 0]
    })
    const [isManuallyPanning, setIsManuallyPanning] = useState(false)

    const detailViewStateRef = useRef<VivViewState | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleResize = useCallback(({ width, height }: { width: number; height: number }) => {
        const newSize = {
            width: Math.max(width, 400),
            height: Math.max(height, 400)
        }
        setContainerDimensions(newSize)
        setViewerSize(newSize)
    }, [setViewerSize])

    useResizeObserver(containerRef as React.RefObject<HTMLElement>, handleResize)

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

    const selections = useMemo(() => {
        if (!navigationState.channelMap) {
            return []
        }

        const shape = msInfo.shape
        const selection: Record<string, number> = {}
        if (shape.z && shape.z >= 0) {
            selection.z = navigationState.zSlice
        }
        if (shape.t && shape.t >= 0) {
            selection.t = navigationState.timeSlice
        }
        return [selection]
    }, [navigationState, msInfo.shape])

    const colors = useMemo(() => {
        const defaultColors = [
            [255, 255, 255],
            [128, 128, 128],
        ]

        if (!navigationState.channelMap) {
            return [defaultColors[0]]
        }

        const channelMap = navigationState.channelMap
        const channelMapEntries = Object.entries(channelMap)

        return Array.from({ length: msInfo.shape.c! }, (_, i) => {
            for (let j = 0; j < channelMapEntries.length; j++) {
                if (channelMapEntries[j][1] === i) {
                    return defaultColors[j]
                }
            }
            return [0, 0, 0]
        })
    }, [navigationState.channelMap, msInfo.shape.c])

    const overview = useMemo(() => ({
        height: Math.min(120, Math.floor(containerDimensions.height * 0.2)),
        width: Math.min(120, Math.floor(containerDimensions.width * 0.2)),
        zoom: -3,
        backgroundColor: [0, 0, 0]
    }), [containerDimensions])

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

    const initialViewState = useMemo(() => {
        if (vivLoaders.length === 0) return undefined;
        return getDefaultInitialViewState(vivLoaders, containerDimensions, 0) as VivViewState
    }, [vivLoaders, containerDimensions])

    const viewStates = useMemo(() => {
        if (vivLoaders.length === 0 || views.length === 0) {
            return []
        }

        const overviewState = getDefaultInitialViewState(vivLoaders, overview, 0.5) as VivViewState

        // Priority: controlledDetailViewState (for one-shot jumps) > vivViewState (current) > initialViewState
        const detailState = controlledDetailViewState
            || vivViewState
            || initialViewState

        return [
            { ...detailState, id: DETAIL_VIEW_ID },
            { ...detailState, id: FRAME_VIEW_ID },
            { ...overviewState, id: OVERVIEW_VIEW_ID }
        ]
    }, [vivLoaders, views, overview, controlledDetailViewState, vivViewState, initialViewState])

    const createLayerProps = useCallback((frameOverlayLayers: Layer[] = []) => {
        if (vivLoaders.length === 0 || views.length === 0 || !msInfo.shape.c) {
            return []
        }

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

        const contrastLimits = Array.from({ length: msInfo.shape.c }, (_, index) => {
            const entries = Object.entries(navigationState.channelMap)
            for (let i = 0; i < entries.length; i++) {
                if (entries[i][1] === index) {
                    return [0, navigationState.contrastLimits[i]]
                }
            }
            return [0, maxValue]
        }) as [number, number][]

        const channelsVisible = Array.from({ length: msInfo.shape.c }, (_, index) => {
            return Object.values(navigationState.channelMap).includes(index)
        })

        const baseProps = {
            loader: vivLoaders,
            selections,
            colors,
            contrastLimits,
            channelsVisible
        }

        return views.map((view) => {
            if (view.id === FRAME_VIEW_ID) {
                return { ...baseProps, frameOverlayLayers }
            }
            return baseProps
        })
    }, [vivLoaders, views, selections, colors, navigationState.channelMap, navigationState.contrastLimits, msInfo.shape.c, msInfo.dtype])

    const layerProps = useMemo(() => createLayerProps([]), [createLayerProps])

    const handleViewStateChange = useCallback(({ viewId, viewState }: {
        viewId: string
        viewState: VivViewState
        oldViewState: VivViewState
    }) => {
        if (viewId === DETAIL_VIEW_ID) {
            detailViewStateRef.current = viewState
            setVivViewState(viewState);

            if (controlledDetailViewState && !isManuallyPanning) {
                setControlledDetailViewState(null)
            }
        }
    }, [isManuallyPanning, setVivViewState, controlledDetailViewState, setControlledDetailViewState])

    return {
        vivLoaders,
        containerDimensions,
        detailViewDrag,
        isManuallyPanning,
        detailViewStateRef,
        containerRef,

        selections,
        colors,
        overview,
        views,
        viewStates,
        initialViewState,
        layerProps,

        setContainerDimensions,
        setDetailViewDrag,
        setControlledDetailViewState,
        setIsManuallyPanning,
        handleViewStateChange,
        createLayerProps
    }
}