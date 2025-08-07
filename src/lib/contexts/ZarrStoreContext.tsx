'use client'

import React, { 
    createContext, useContext,
    useState, useCallback, useEffect
} from 'react'
import * as zarrita from 'zarrita'

import { 
  ZarrStoreSuggestionType, type ZarrStoreSuggestedPath,
  type ZarrStoreContextType, type ZarrStoreState, type ZarrStoreProviderProps 
} from '../types/store'
import * as omeUtils from '../utils/ome-utils'

import type OMEAttrs from '../types/ome'
import type { AxisKey, IMultiscaleInfo, MultiscaleShape } from '../types/loader'


const ZarrStoreContext = createContext<ZarrStoreContextType | null>(null)

export function useZarrStore() {
  const context = useContext(ZarrStoreContext)
  if (!context) {
    throw new Error('useZarrStore must be used within a ZarrStoreProvider')
  }
  return context
}


export function ZarrStoreProvider({ children, initialSource = '' }: ZarrStoreProviderProps) {
  const [state, setState] = useState<ZarrStoreState>({
    store: null,
    root: null,
    omeData: null,
    msInfo: null,
    cellposeArray: null,
    isCellposeLoading: false,
    cellposeError: null,
    isLoading: false,
    error: null,
    infoMessage: null,
    source: initialSource,
    hasLoadedArray: false,
    suggestedPaths: [],
    suggestionType: ZarrStoreSuggestionType.NO_OME
  })

  const setSource = useCallback((url: string) => {
    setState(prev => ({ ...prev, source: url }))
  }, [])

  // Cellpose detection utility
  const detectCellposeArray = useCallback(async (): Promise<zarrita.Array<any> | null> => {
    if (!state.store) return null;

    try {
      console.log('🔍 Searching for Cellpose data at labels/Cellpose...')

      // Create a temporary root from the base `store` to search from the top level.
      const rootGroup = zarrita.root(state.store)
      const cellposeGroup = await zarrita.open(rootGroup.resolve('labels/Cellpose'))

      if (cellposeGroup instanceof zarrita.Group) {
        // Drill into OME multiscales metadata
        const multiscales = (cellposeGroup.attrs?.ome as OMEAttrs)?.multiscales
        if (multiscales && multiscales[0]?.datasets?.[0]?.path) {
          // Always use the first dataset (highest resolution)
          const array = await zarrita.open(
            cellposeGroup.resolve(multiscales[0].datasets[0].path)
          )
          if (array instanceof zarrita.Array) {
            console.log('✅ Cellpose array found:', array)
            return array
          }
        }
      }
      // If it's already an array, just return it
      if (cellposeGroup instanceof zarrita.Array) {
        console.log('✅ Cellpose array found (direct array):', cellposeGroup)
        return cellposeGroup
      }
      // If not found, return null
      return null
    } catch (error) {
      console.log(`❌ No Cellpose data at labels/Cellpose:`, error)
      return null
    }
  }, [state.store])

  // Load Cellpose data when multiscale image is ready
  const refreshCellposeData = useCallback(async () => {
    if (!state.hasLoadedArray || !state.msInfo) {
      setState(prev => ({ 
        ...prev, 
        cellposeArray: null, 
        cellposeError: null,
        isCellposeLoading: false 
      }))
      return
    }

    setState(prev => ({ ...prev, isCellposeLoading: true, cellposeError: null }))

    try {
      const cellposeArr = await detectCellposeArray()
      
      setState(prev => ({ 
        ...prev, 
        cellposeArray: cellposeArr,
        isCellposeLoading: false,
        cellposeError: null
      }))
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error loading Cellpose data'
      console.error('❌ Error loading Cellpose data:', errorMessage)
      setState(prev => ({ 
        ...prev, 
        cellposeError: errorMessage,
        cellposeArray: null,
        isCellposeLoading: false
      }))
    }
  }, [state.hasLoadedArray, state.msInfo, detectCellposeArray])

  // Function to process a group and extract OME metadata
  // to further predict the internal structure
  const processGroup = useCallback(async (
    grp: zarrita.Group<zarrita.FetchStore>
  ) => {
    console.log('📊 Group loaded:', grp)

    // Use utility functions to determine the data type
    const attrs = (grp.attrs?.ome ?? grp.attrs) as OMEAttrs
    
    // Check if this is a plate using utility function
    if (omeUtils.isOmePlate(attrs) || omeUtils.isOmeWell(attrs)) {
      console.log('🧪 Detected OME-Zarr plate/well structure')
      setState(prev => ({
        ...prev,
        omeData: attrs,
        isLoading: false,
        error: null,
        infoMessage: 'OME-Plate/OME-Well structure is not supported.',
        hasLoadedArray: false,
        suggestedPaths: [],
        suggestionType: ZarrStoreSuggestionType.PLATE_WELL
      }))
      return
    }
    
    // Check if this has multiscales using utility function
    if (omeUtils.isOmeMultiscales(attrs)) {
      console.log('📈 Detected OME-Zarr multiscales structure')
      
      // Extract available resolutions from multiscales
      const multiscales = attrs.multiscales![0]
      const availableResolutions = multiscales.datasets.map(dataset => dataset.path)
      const axes = multiscales.axes?.map(axis => axis.name) || []
      
      // Extract available channels (if present in OMERO metadata)
      let availableChannels: string[] = []
      if (attrs.omero?.channels) {
        availableChannels = attrs.omero.channels.map((ch, idx) => 
          ch.label || `Channel ${idx}`
        )
      }

      // Load the lowest resolution array to get the shape and dtype
      const lowestResArray = await zarrita.open(
        grp.resolve(multiscales.datasets[0].path)
      ) as zarrita.Array<zarrita.DataType>

      const shape = axes.reduce((acc, axis) => {
        acc[axis as AxisKey] = lowestResArray.shape[axes.indexOf(axis)]
        return acc
      }, {} as MultiscaleShape)

      if (!availableChannels) {
        availableChannels = Array(shape.c).fill(null).map((_, index) => `Channel ${index + 1}`);
      }

      // Extract multiscale Information
      const msInfo = {
        shape,
        dtype: lowestResArray.dtype,
        resolutions: availableResolutions,
        channels: availableChannels
      } as IMultiscaleInfo;

      setState(prev => ({
        ...prev,
        omeData: attrs,
        msInfo: msInfo,
        isLoading: false,
        error: null,
        infoMessage: null,
        hasLoadedArray: true,
        suggestedPaths: [],
      }))

      console.log('[ZarrStoreContext] ✅ Group processed successfully')
      return
    }

    // ...existing code...
    if (attrs && (!attrs.multiscales || attrs.multiscales.length === 0)) {
      console.log('OME metadata found but no multiscales - suggesting subdirectories');
      
      const suggestedPaths: ZarrStoreSuggestedPath[] = [];
      const commonPaths = ['0', '1', '2', '3', '4', '5', 'labels', 'metadata'];

      for (const path of commonPaths) {
        try {
          const childOpened = await zarrita.open(grp.resolve(path));
          if (childOpened.attrs) {
            const hasOme = childOpened.attrs.ome || childOpened.attrs.multiscales;
            suggestedPaths.push({
              path,
              isGroup: true,
              hasOme: !!hasOme
            });
          } else {
            suggestedPaths.push({
              path,
              isGroup: false,
              hasOme: false
            });
          }
        } catch {
          // Path doesn't exist, skip
        }
      }

      setState(prev => ({
        ...prev,
        omeData: attrs,
        isLoading: false,
        error: null,
        infoMessage: 'No multiscale image found.',
        suggestedPaths,
        suggestionType: ZarrStoreSuggestionType.NO_MULTISCALE
      }));
      return;
    }

    // If none of the above match, this is not a supported OME-Zarr structure
    throw new Error("No supported OME-Zarr structure found in metadata")
  }, [])

  const loadStore = useCallback(async (url: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, infoMessage: null }))
    
    try {
      console.log('Loading Zarr store from:', url)
      
      const store = new zarrita.FetchStore(url)
      const opened = await zarrita.open(store)
      
      // Check if this is actually a group (not an array)
      if (opened instanceof zarrita.Array) {
        throw new Error("This appears to be an array, not a group. OME-Zarr requires group structure.")
      }

      // ✅ ALWAYS set store and root first - even if processGroup fails later
      setState(prev => ({ ...prev, store, root: opened }))
      
      // Now process the group
      await processGroup(opened)
      
    } catch (error) {
      console.error('Error loading Zarr store:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        infoMessage: null,
        suggestedPaths: [],
        suggestionType: ZarrStoreSuggestionType.NO_OME
      }))
    }
  }, [processGroup])

  const navigateToSuggestion = useCallback(async (suggestionPath: string) => {
    if (!state.store) {
      console.error('No store available for navigation')
      return
    }

    console.log(`Navigating to suggestion: ${suggestionPath}`)
    
    try {
      // Navigate within the current store, not by changing the URL
      const rootGroup = zarrita.root(state.store)
      const targetGroup = await zarrita.open(rootGroup.resolve(suggestionPath))
      
      if (targetGroup instanceof zarrita.Group) {
        setState(prev => ({ ...prev, root: targetGroup }))
        await processGroup(targetGroup)
      } else {
        throw new Error("Suggested path does not point to a group")
      }
    } catch (error) {
      console.error(`Error navigating to suggestion ${suggestionPath}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: `Failed to navigate to ${suggestionPath}: ${errorMessage}`,
        isLoading: false
      }))
    }
  }, [state.store, processGroup])

  // Auto-load Cellpose data when multiscale image is loaded
  useEffect(() => {
    refreshCellposeData()
  }, [refreshCellposeData])

  const value: ZarrStoreContextType = {
    ...state,
    loadStore,
    setSource,
    navigateToSuggestion,
    refreshCellposeData
  }

  return (
    <ZarrStoreContext.Provider value={value}>
      {children}
    </ZarrStoreContext.Provider>
  )
}
