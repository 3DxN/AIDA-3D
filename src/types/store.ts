import type { FetchStore, Location, Array as ZArray } from "zarrita"
import type { ReactNode } from "react"

import type OMEAttrs from "./metadata/ome"
import type { IMultiscaleInfo } from "./metadata/loader"


export enum ZarrStoreSuggestionType {
  /**
   * OME Plate or Well metadata found
   */
  PLATE_WELL,
  /**
   * Generic OME Metadata found, but is not multiscales
   */
  NO_MULTISCALE,
  /**
   * CellPose segmentation metadata found
   * This is a special case where we suggest CellPose-specific paths
   * even if no OME metadata is present.
   */
  CELLPOSE,
  /**
   * No OME metadata found
   * This is the default state when no suggestions are available.
   */
  NO_OME
}

export interface ZarrStoreSuggestedPath {
  path: string
  isGroup: boolean
  hasOme: boolean
}

export interface ZarrStoreState {
  /**
   * The currently loaded Zarr store
   */
  store: FetchStore | null
  /**
   * The relative path location of the Zarr store that is currently being viewed
   */
  root: Location<FetchStore> | null
  /**
   * Single OME object containing all metadata of that group
   */
  omeData: OMEAttrs | null
  /**
   * Information about the current multiscale group
   */
  msInfo: IMultiscaleInfo | null
  /**
   * Cellpose/segmentation array loaded at store level
   */
  cellposeArray: ZArray<FetchStore> | null
  /**
   * All available Cellpose resolution arrays
   */
  cellposeArrays: ZArray<FetchStore>[]
  /**
   * Available Cellpose resolution paths (e.g., ['0', '1', '2'])
   */
  cellposeResolutions: string[]
  /**
   * Scale factors for each Cellpose resolution level [z, y, x]
   */
  cellposeScales: number[][]
  /**
   * Currently selected Cellpose resolution index
   */
  selectedCellposeResolution: number
  /**
   * Whether the Cellpose array is currently being loaded
   */
  isCellposeLoading: boolean
  /**
   * Error message if Cellpose loading fails
   */
  cellposeError: string | null
  /**
   * Whether the viewing image data is being loaded
   */
  isLoading: boolean
  /**
   * Error message if loading the store or paths within it fails
   */
  error: string | null
  /**
   * For non-error informational messages (such as further navigation instructions)
   */
  infoMessage: string | null
  /**
   * Base server URL of the Zarr store (e.g., 'http://141.147.64.20:5500/')
   */
  source: string
  /**
   * Relative path to the zarr array directory within the store (e.g., '0')
   */
  zarrPath: string
  /**
   * Relative path to the cellpose segmentation directory (e.g., 'labels/Cellpose')
   */
  cellposePath: string
  /**
   * Whether the user has successfully loaded a multiscales image array
   * And to initialise the display of the viewer if so.
   */
  hasLoadedArray: boolean
  /**
   * Suggested paths for navigation based on the current store
   * If the current group is not an multiscales group or image
   */
  suggestedPaths: Array<{
    path: string;
    isGroup: boolean;
    hasOme: boolean
  }>
  /**
   * Type of suggestions being offered based on the current store
   * This helps in determining how to present the suggestions to the user
   */
  suggestionType: ZarrStoreSuggestionType // Type of suggestions being offered
  /**
   * Callback function to handle properties found in Cellpose zarr.json
   */
  onPropertiesFound?: (properties: any[]) => void
}

export interface ZarrStoreContextType extends ZarrStoreState {
  loadStore: (url: string) => Promise<void>
  setSource: (url: string) => void
  setZarrPath: (path: string) => void
  setCellposePath: (path: string) => void
  loadZarrArray: (zarrPath: string) => Promise<void>
  loadCellposeData: (cellposePath: string) => Promise<void>
  loadFromUrlParams: (serverUrl: string, zarrPath: string, cellposePath: string) => Promise<void>
  navigateToSuggestion: (suggestionPath: string) => void
  refreshCellposeData: () => Promise<void>
  setPropertiesCallback: (callback: (properties: any[]) => void) => void
  setSelectedCellposeResolution: (index: number) => void
}

export interface ZarrStoreProviderProps {
  children: ReactNode
  initialSource?: string
  initialZarrPath?: string
  initialCellposePath?: string
}