/**
 * Viv viewer types - state management, layer props, and viewer configuration
 */

import type { VivView } from "@hms-dbmi/viv"
import type { Layer, View } from "deck.gl"

import type ZarrPixelSource from "../../lib/ext/ZarrPixelSource"


// Core Viv viewer state types
export interface VivViewState {
  target: [number, number, number];
  zoom: number;
  [key: string]: any; // Viv may add more properties
}

export interface VivDetailViewState {
  isDragging: boolean,
  startPos: [number, number],
  startTarget: [number, number, number] // [x, y, zoom]
}

// Viv viewer hook interfaces
export interface VivViewerState {
  vivLoaders: ZarrPixelSource[]
  containerDimensions: { width: number; height: number }
  detailViewDrag: VivDetailViewState
  controlledDetailViewState: VivViewState | null
  isManuallyPanning: boolean
  detailViewStateRef: React.RefObject<VivViewState | null>
  containerRef: React.RefObject<HTMLDivElement | null>
}

export interface VivViewerComputed {
  selections: Record<string, number>[]
  colors: number[][]
  overview: {
    height: number
    width: number
    zoom: number
    backgroundColor: number[]
  }
  views: (VivView | View)[]
  viewStates: VivViewState[]
  layerProps: VivLayerProps[]
}

export interface VivLayerProps {
  loader: ZarrPixelSource[];
  selections: Record<string, number>[];
  colors: number[][];
  contrastLimits: [number, number][];
  channelsVisible: boolean[];
  frameOverlayLayers?: Layer[]; // Optional for frame view
}

export interface VivViewerActions {
  setContainerDimensions: (dimensions: { width: number; height: number }) => void
  setDetailViewDrag: (drag: VivDetailViewState) => void
  setControlledDetailViewState: (state: VivViewState | null) => void
  setIsManuallyPanning: (panning: boolean) => void
  handleViewStateChange: ({ viewId, viewState }: {
    viewId: string
    viewState: VivViewState
    oldViewState: VivViewState
  }) => void
  createLayerProps: (frameOverlayLayers?: Layer[]) => VivLayerProps[]
}

// Viv loader configuration
export interface VivLoaderConfig {
  source: string
  name?: string
  opacity?: number
  colormap?: string
  tileSize?: number
}

export interface VivCompatibleData {
  loader: (ZarrPixelSource)[]
  metadata: {
    axis_labels: string[]
    model_matrix: number[][]
    channels: Array<{
      color: [number, number, number]
      window: [number, number]
      label: string
      visible: boolean
    }>
    domains: Record<string, number[]>
    defaults: {
      selection: Record<string, number>
      colormap: string
      opacity: number
    }
    name: string
  }
}
