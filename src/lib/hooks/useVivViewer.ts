import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import * as zarrita from 'zarrita'
import {
    OverviewView,
    DetailView,
    getDefaultInitialViewState,
    OVERVIEW_VIEW_ID,
    DETAIL_VIEW_ID,
} from '@hms-dbmi/viv'
import { ColorPaletteExtension } from '@vivjs/extensions'

import ZarrPixelSource from '../ext/ZarrPixelSource'
import MockPixelSource from '../ext/MockPixelSource' // Import Mock
import { FrameView, FRAME_VIEW_ID } from '../../components/viewer2D/zarr/map/FrameView'
import { useResizeObserver } from './useResizeObserver'
import { useViewer2DData } from '../contexts/Viewer2DDataContext'
import { shouldUseHEStaining, getRenderingMode, HE_STAIN_COLORS } from '../utils/channelMixer'
import { HEStainExtension } from '../extensions/HEStainExtension'

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
    const [vivLoaders, setVivLoaders] = useState<any[]>([])
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

            // DIAGNOSTIC: Inject Mock Loader if real data fails to render
            // setVivLoaders([new MockPixelSource()]); 
            // Uncomment the line above to test with noise pattern
            // return; // STOP HERE so we don't load real data
            
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
    // IMPORTANT: These colors are ONLY used by ColorPaletteExtension when H&E staining is disabled.
    // When H&E is enabled, HEStainExtension computes colors via Beer-Lambert law in the shader
    // and completely overrides these values.
    const colors = useMemo(() => {
        // Default color palette: Force White for MRI
        const defaultColors = [
            [255, 255, 255], // White
            [0, 255, 0],     // Green
            [255, 0, 0],     // Red
        ]

        if (!navigationState.channelMap) {
            return [defaultColors[0]]
        }

        const channelMap = navigationState.channelMap
        const heStainingEnabled = navigationState.heStainingOn && shouldUseHEStaining(channelMap)

        // Helper to convert normalized [0-1] color to RGB [0-255]
        const toRGB = (normalized: readonly [number, number, number]): number[] =>
            normalized.map(v => Math.round(v * 255))

        // Create colors array with one entry per mapped (non-null) channel, in role order
        const roleColors = Object.entries(channelMap)
            .filter(entry => entry[1] !== null)
            .map(([role, channelIndex], roleIndex) => {
                // If single channel (MRI), ALWAYS return White
                if (Object.values(channelMap).filter(v => v !== null).length === 1) {
                    return [255, 255, 255];
                }

                // When H&E is enabled: Set placeholder colors (unused, shader handles rendering)
                // When H&E is disabled: Set actual rendering colors for false-color display
                if (role === 'nucleus') {
                    // Nucleus: blue (false-color) or hematoxylin blue-purple (H&E placeholder)
                    return heStainingEnabled
                        ? toRGB(HE_STAIN_COLORS.hematoxylin)  // Placeholder, not actually used
                        : [0, 0, 255]  // Blue for false-color rendering
                } else if (role === 'cytoplasm') {
                    // Cytoplasm: green (false-color) or eosin pink-red (H&E placeholder)
                    return heStainingEnabled
                        ? toRGB(HE_STAIN_COLORS.eosin)  // Placeholder, not actually used
                        : [0, 255, 0]  // Green for false-color rendering
                }

                // Fallback for unrecognized roles
                return defaultColors[roleIndex % defaultColors.length]
            })

        console.log(`🎨 Colors (${heStainingEnabled ? 'H&E shader mode - unused placeholders' : 'false-color mode'}):`, roleColors)
        return roleColors.length > 0 ? roleColors : [defaultColors[0]]
    }, [navigationState.channelMap, navigationState.heStainingOn])

    // Overview configuration
    const overview = useMemo(() => ({
        height: Math.min(120, Math.floor(containerDimensions.height * 0.2)),
        width: Math.min(120, Math.floor(containerDimensions.width * 0.2)),
        zoom: -3,
        backgroundColor: [0, 0, 0] // Black
    }), [containerDimensions])

    // Generate view instances
    const views = useMemo(() => {
        if (vivLoaders.length === 0) {
            return []
        }

        const detailView = new DetailView({
            id: DETAIL_VIEW_ID,
            height: containerDimensions.height,
            width: containerDimensions.width,
            clear: true // Clear buffer
        })

        const overviewView = new OverviewView({
            id: OVERVIEW_VIEW_ID,
            loader: vivLoaders,
            detailHeight: containerDimensions.height,
            detailWidth: containerDimensions.width,
            backgroundColor: [0, 0, 0] // Black
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

        // Detect false-color rendering mode
        const useFalseColor = shouldUseHEStaining(navigationState.channelMap)
        const renderingMode = getRenderingMode(navigationState.channelMap)

        // Get max value for dtype to use for full-range contrast limits
        const getMaxValueForDtype = (dtype: string): number => {
            switch (dtype) {
                case 'uint8': return 255;
                case 'uint16': return 65535;
                case 'uint32': return 4294967295;
                case 'float32':
                case 'float64': return 1000.0;
                default: return 65535;
            }
        };

        const maxValue = getMaxValueForDtype(msInfo.dtype);

        // Create contrast limits array with one entry per selected channel, in role order
        const contrastLimits = Object.entries(navigationState.channelMap)
            .filter(entry => entry[1] !== null)
            .map(([role, channelIndex], roleIndex) => {
                // FORCE MRI CONTRAST: [0, 1500]
                // This ensures we see the brain, regardless of what the slider says.
                return [0, 1500] as [number, number];
            })

        // All selected channels are visible (we only render them because selections filters)
        const channelsVisible = Array.from(
            { length: Object.values(navigationState.channelMap).filter(c => c !== null).length },
            () => true
        )

        // Setup extensions: always include ColorPaletteExtension, optionally add H&E extension
        const extensions = [new ColorPaletteExtension()]
        if (navigationState.heStainingOn && useFalseColor) {
            extensions.push(new HEStainExtension())
        }

        const baseProps = {
            loader: vivLoaders,
            selections,
            colors,
            contrastLimits,
            channelsVisible,
            extensions,
            // Add H&E props as layer props when enabled
            ...(navigationState.heStainingOn && useFalseColor ? {
                heStainHematoxylinWeight: navigationState.heStainHematoxylinWeight,
                heStainEosinWeight: navigationState.heStainEosinWeight,
                heStainMaxIntensity: navigationState.heStainMaxIntensity,
                heStainEnabled: true
            } : {}),
            // False-color rendering metadata for use by overlay components
            falseColorMode: {
                enabled: useFalseColor,
                renderingMode: renderingMode,
                nucleusChannelIndex: navigationState.channelMap.nucleus,
                cytoplasmChannelIndex: navigationState.channelMap.cytoplasm,
            }
        }

        // Debug: Log what's actually being sent to Viv
        console.log('📊 VIV LAYER PROPS:', {
            numLoaders: vivLoaders.length,
            numSelections: selections.length,
            colors: colors,
            selections: selections,
            contrastLimits: contrastLimits,
            channelsVisible: channelsVisible,
            numExtensions: extensions.length,
            heStainEnabled: navigationState.heStainingOn && useFalseColor,
            heStainParams: (navigationState.heStainingOn && useFalseColor) ? {
                hematoxylinWeight: navigationState.heStainHematoxylinWeight,
                eosinWeight: navigationState.heStainEosinWeight,
                maxIntensity: navigationState.heStainMaxIntensity
            } : null
        })

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