'use client'

import React, { 
    createContext, useContext,
    useState, useCallback, useEffect
} from 'react'
import * as zarrita from 'zarrita'

import * as omeUtils from '../utils/ome'

import { 
  ZarrStoreSuggestionType, type ZarrStoreSuggestedPath,
  type ZarrStoreContextType, type ZarrStoreState, type ZarrStoreProviderProps 
} from '../../types/store'
import type OMEAttrs from '../../types/metadata/ome'
import type { AxisKey, IMultiscaleInfo, MultiscaleShape } from '../../types/metadata/loader'


// Expose default labels path for Cellpose or other masks so it can be customized
export const DEFAULT_LABELS_SEGMENTATION_PATH = 'labels/Cellpose'


const ZarrStoreContext = createContext<ZarrStoreContextType | null>(null)

export function useZarrStore() {
  const context = useContext(ZarrStoreContext)
  if (!context) {
    throw new Error('useZarrStore must be used within a ZarrStoreProvider')
  }
  return context
}


export function ZarrStoreProvider({
  children,
  initialSource = '',
  initialZarrPath = '',
  initialCellposePath = 'labels/Cellpose'
}: ZarrStoreProviderProps) {
  const [state, setState] = useState<ZarrStoreState>({
    store: null,
    root: null,
    omeData: null,
    msInfo: null,
    cellposeArray: null,
    cellposeArrays: [],
    cellposeResolutions: [],
    cellposeScales: [],
    selectedCellposeResolution: 0,
    isCellposeLoading: false,
    cellposeError: null,
    isLoading: false,
    error: null,
    infoMessage: null,
    source: initialSource,
    zarrPath: initialZarrPath,
    cellposePath: initialCellposePath,
    hasLoadedArray: false,
    suggestedPaths: [],
    suggestionType: ZarrStoreSuggestionType.NO_OME,
    onPropertiesFound: undefined
  })

  const setSource = useCallback((url: string) => {
    setState(prev => ({ ...prev, source: url }))
  }, [])

  const setZarrPath = useCallback((path: string) => {
    setState(prev => ({ ...prev, zarrPath: path }))
  }, [])

  const setCellposePath = useCallback((path: string) => {
    setState(prev => ({ ...prev, cellposePath: path }))
  }, [])

  const setPropertiesCallback = useCallback((callback: (properties: any[]) => void) => {
    setState(prev => ({ ...prev, onPropertiesFound: callback }))
  }, [])

  // Cellpose detection utility - now loads all resolutions
  const detectCellposeArray = useCallback(
    async (cellposePath: string): Promise<{
      arrays: zarrita.Array<zarrita.Uint32>[],
      resolutions: string[],
      scales: number[][],
      defaultArray: zarrita.Array<zarrita.Uint32> | null
    }> => {
      if (!state.store || !cellposePath) return { arrays: [], resolutions: [], scales: [], defaultArray: null };

      try {
        console.log(`🔍 Searching for Cellpose data at ${cellposePath}...`)

        // Create a temporary root from the base `store` to search from the top level.
        const rootGroup = zarrita.root(state.store)
        const cellposeGroup = await zarrita.open(rootGroup.resolve(cellposePath))

        if (cellposeGroup instanceof zarrita.Group) {
          // Check for properties in the zarr.json attributes
          const attrs = cellposeGroup.attrs as any
          if (attrs?.ome?.['image-label']?.properties) {
            console.log('🔍 Found properties in Cellpose zarr.json:', attrs.ome['image-label'].properties)

            // Trigger properties loading callback if available
            if (state.onPropertiesFound) {
              try {
                state.onPropertiesFound(attrs.ome['image-label'].properties)
              } catch (error) {
                console.error('❌ Error loading properties from zarr.json:', error)
              }
            }
          }

          // Drill into OME multiscales metadata
          const multiscales = (cellposeGroup.attrs?.ome as OMEAttrs)?.multiscales
          if (multiscales && multiscales[0]?.datasets?.length > 0) {
            // Load ALL resolution levels
            const arrays: zarrita.Array<zarrita.Uint32>[] = []
            const resolutions: string[] = []
            const scales: number[][] = []

            for (const dataset of multiscales[0].datasets) {
              try {
                const array = await zarrita.open(
                  cellposeGroup.resolve(dataset.path)
                )
                if (array instanceof zarrita.Array) {
                  arrays.push(array as zarrita.Array<zarrita.Uint32>)
                  resolutions.push(dataset.path)

                  // Extract scale factors from coordinateTransformations
                  const transforms = dataset.coordinateTransformations
                  if (transforms && transforms.length > 0 && transforms[0].type === 'scale') {
                    scales.push(transforms[0].scale as number[])
                  } else {
                    scales.push([1.0, 1.0, 1.0]) // Default scale if not found
                  }
                }
              } catch (error) {
                console.warn(`⚠️ Failed to load Cellpose resolution at ${dataset.path}:`, error)
              }
            }

            console.log(`✅ Loaded ${arrays.length} Cellpose resolution levels:`, resolutions)
            console.log(`   Scales:`, scales)
            return {
              arrays,
              resolutions,
              scales,
              defaultArray: arrays[0] || null
            }
          }
        }
        // If it's already an array, just return it
        if (cellposeGroup instanceof zarrita.Array) {
          console.log('✅ Cellpose array found (direct array):', cellposeGroup)
          const arr = cellposeGroup as zarrita.Array<zarrita.Uint32>
          return {
            arrays: [arr],
            resolutions: ['0'],
            scales: [[1.0, 1.0, 1.0]],
            defaultArray: arr
          }
        }
        // If not found, return empty
        return { arrays: [], resolutions: [], scales: [], defaultArray: null }
      } catch (error) {
        console.log(`❌ No Cellpose data at ${cellposePath}:`, error)
        return { arrays: [], resolutions: [], scales: [], defaultArray: null }
      }
    }, [state.store, state.onPropertiesFound]
  )


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
          ch.label || `Channel ${idx + 1}`
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

      if (availableChannels.length === 0) {
        for (let i = 0; i < shape.c!; i++) {
          availableChannels.push(`Channel ${i + 1}`)
        }
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

    // src/lib/contexts/ZarrStoreContext.tsx

    const loadStore = useCallback(async (url: string) => {
        setState(prev => ({
          ...prev,
          isLoading: true,
          error: null,
          infoMessage: null,
          hasLoadedArray: false,
          omeData: null,
          msInfo: null,
          cellposeArray: null,
          cellposeArrays: [],
          cellposeResolutions: [],
          cellposeScales: []
        }))

        try {
            console.log('Loading Zarr store from:', url)

            const store = new zarrita.FetchStore(url)
            const opened = await zarrita.open(store)

            if (opened instanceof zarrita.Array) {
                throw new Error("This appears to be an array, not a group. OME-Zarr requires group structure.")
            }

            // Scan for available directories
            const suggestedPaths: ZarrStoreSuggestedPath[] = [];
            const commonPaths = ['0', '1', '2', '3', '4', '5', 'labels', 'metadata'];

            for (const path of commonPaths) {
              try {
                const childOpened = await zarrita.open(opened.resolve(path));
                if (childOpened.attrs) {
                  const hasOme = childOpened.attrs.ome || childOpened.attrs.multiscales;
                  suggestedPaths.push({
                    path,
                    isGroup: childOpened instanceof zarrita.Group,
                    hasOme: !!hasOme
                  });
                }
              } catch {
                // Path doesn't exist, skip
              }
            }

            setState(prev => ({
              ...prev,
              store,
              root: opened,
              isLoading: false,
              suggestedPaths,
              suggestionType: ZarrStoreSuggestionType.NO_OME,
              infoMessage: 'Store loaded. Please select the zarr array directory.'
            }))

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            console.error('Error loading Zarr store:', errorMessage)
            setState(prev => ({
              ...prev,
              error: `Failed to load store: ${errorMessage}`,
              isLoading: false,
              suggestedPaths: []
            }))
        }
    }, [])

  const loadZarrArray = useCallback(async (zarrPath: string) => {
    if (!state.store) {
      console.error('No store available')
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, infoMessage: null, zarrPath }))

    try {
      console.log(`Loading zarr array from path: ${zarrPath}`)

      const rootGroup = zarrita.root(state.store)
      const targetGroup = await zarrita.open(rootGroup.resolve(zarrPath))

      if (targetGroup instanceof zarrita.Group) {
        setState(prev => ({ ...prev, root: targetGroup }))
        await processGroup(targetGroup)

        // After loading zarr array successfully, scan for cellpose paths
        const cellposeSuggestions: ZarrStoreSuggestedPath[] = [];
        const cellposePaths = ['labels', 'labels/Cellpose', 'labels/cellpose', 'segmentation', 'masks'];

        for (const path of cellposePaths) {
          try {
            const childOpened = await zarrita.open(rootGroup.resolve(path));
            if (childOpened) {
              cellposeSuggestions.push({
                path,
                isGroup: childOpened instanceof zarrita.Group,
                hasOme: false
              });
            }
          } catch {
            // Path doesn't exist, skip
          }
        }

        if (cellposeSuggestions.length > 0) {
          setState(prev => ({
            ...prev,
            suggestedPaths: cellposeSuggestions,
            infoMessage: 'Zarr array loaded. Please select the cellpose segmentation directory.'
          }))
        }
      } else {
        throw new Error("Selected path does not point to a group")
      }
    } catch (error) {
      console.error(`Error loading zarr array from ${zarrPath}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: `Failed to load zarr array: ${errorMessage}`,
        isLoading: false
      }))
    }
  }, [state.store, processGroup])

  const loadCellposeData = useCallback(async (cellposePath: string) => {
    if (!state.store) {
      console.error('No store available')
      return
    }

    setState(prev => ({
      ...prev,
      cellposePath,
      isCellposeLoading: true,
      cellposeError: null
    }))

    try {
      const { arrays, resolutions, scales, defaultArray } = await detectCellposeArray(cellposePath)

      setState(prev => ({
        ...prev,
        cellposeArray: defaultArray,
        cellposeArrays: arrays,
        cellposeResolutions: resolutions,
        cellposeScales: scales,
        selectedCellposeResolution: 0,
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
        cellposeArrays: [],
        cellposeResolutions: [],
        cellposeScales: [],
        isCellposeLoading: false
      }))
    }
  }, [state.store, detectCellposeArray])

  // Refresh Cellpose data (re-load from current cellposePath)
  const refreshCellposeData = useCallback(async () => {
    if (!state.hasLoadedArray || !state.msInfo || !state.cellposePath) {
      return
    }
    await loadCellposeData(state.cellposePath)
  }, [state.hasLoadedArray, state.msInfo, state.cellposePath, loadCellposeData])

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

  // Removed auto-load of Cellpose data - now requires manual selection

  // Load everything from URL params in one go (avoids stale closure issues)
  const loadFromUrlParams = useCallback(async (serverUrl: string, zarrPath: string, cellposePath: string) => {
    try {
      // Step 1: Load store
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        infoMessage: null,
        hasLoadedArray: false,
        omeData: null,
        msInfo: null,
        cellposeArray: null,
        cellposeArrays: [],
        cellposeResolutions: [],
        cellposeScales: [],
        isCellposeLoading: true,
        cellposeError: null
      }))

      const store = new zarrita.FetchStore(serverUrl)
      const opened = await zarrita.open(store)

      if (opened instanceof zarrita.Array) {
        throw new Error("This appears to be an array, not a group. OME-Zarr requires group structure.")
      }

      const rootGroup = zarrita.root(store)

      // Step 2 & 3: Load zarr array and cellpose in parallel
      const [zarrResult, cellposeResult] = await Promise.allSettled([
        // Load zarr array
        (async () => {
          const targetGroup = await zarrita.open(rootGroup.resolve(zarrPath))

          if (!(targetGroup instanceof zarrita.Group)) {
            throw new Error("Selected path does not point to a group")
          }

          setState(prev => ({
            ...prev,
            store,
            root: targetGroup,
            zarrPath
          }))

          // Process the group (this sets msInfo and hasLoadedArray)
          await processGroup(targetGroup)
        })(),

        // Load cellpose
        (async () => {
          const cellposeGroup = await zarrita.open(rootGroup.resolve(cellposePath))

          if (!(cellposeGroup instanceof zarrita.Group)) {
            throw new Error('Cellpose path is not a group')
          }

          const attrs = cellposeGroup.attrs as any

          if (attrs?.ome?.['image-label']?.properties) {
            const properties = attrs.ome['image-label'].properties
            if (state.onPropertiesFound) {
              state.onPropertiesFound(properties)
            }
          }

          // The metadata structure is: attrs.ome.multiscales[0]
          const multiscalesAttr = attrs?.ome?.multiscales?.[0]

          if (!multiscalesAttr?.datasets) {
            throw new Error('No multiscales datasets found in cellpose group')
          }

          const datasets = multiscalesAttr.datasets
          const arrays: zarrita.Array<zarrita.Uint32>[] = []
          const resolutions: string[] = []
          const scales: number[][] = []

          for (const dataset of datasets) {
            const resPath = dataset.path
            const childArray = await zarrita.open(cellposeGroup.resolve(resPath), { kind: 'array' })

            if (childArray instanceof zarrita.Array) {
              arrays.push(childArray as zarrita.Array<zarrita.Uint32>)
              resolutions.push(resPath)

              const coordinateTransformations = dataset.coordinateTransformations || []
              const scaleTransform = coordinateTransformations.find((t: any) => t.type === 'scale')
              if (scaleTransform?.scale) {
                scales.push(scaleTransform.scale)
              } else {
                scales.push([1, 1, 1])
              }
            }
          }

          const defaultArray = arrays.length > 0 ? arrays[0] : null

          return { arrays, resolutions, scales, defaultArray }
        })()
      ])

      // Handle zarr result
      if (zarrResult.status === 'rejected') {
        throw new Error(`Failed to load zarr array: ${zarrResult.reason}`)
      }

      // Handle cellpose result
      if (cellposeResult.status === 'fulfilled') {
        const { arrays, resolutions, scales, defaultArray } = cellposeResult.value
        setState(prev => ({
          ...prev,
          cellposeArray: defaultArray,
          cellposeArrays: arrays,
          cellposeResolutions: resolutions,
          cellposeScales: scales,
          cellposePath,
          selectedCellposeResolution: 0,
          isCellposeLoading: false,
          cellposeError: null,
          isLoading: false
        }))
      } else {
        const errorMessage = cellposeResult.reason instanceof Error ? cellposeResult.reason.message : 'Unknown error loading Cellpose data'
        setState(prev => ({
          ...prev,
          cellposeError: errorMessage,
          cellposeArray: null,
          cellposeArrays: [],
          cellposeResolutions: [],
          cellposeScales: [],
          cellposePath,
          isCellposeLoading: false,
          isLoading: false
        }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: `Failed to load: ${errorMessage}`,
        isLoading: false,
        isCellposeLoading: false
      }))
    }
  }, [processGroup, state.onPropertiesFound])

  // Function to change the selected Cellpose resolution
  const setSelectedCellposeResolution = useCallback((index: number) => {
    setState(prev => {
      if (index >= 0 && index < prev.cellposeArrays.length) {
        const newArray = prev.cellposeArrays[index]
        console.log(`📊 Switching to Cellpose resolution ${index}: ${prev.cellposeResolutions[index]}`)
        console.log(`   Array shape: ${newArray.shape.join(' × ')}`)
        console.log(`   Array object changed: ${newArray !== prev.cellposeArray}`)
        return {
          ...prev,
          selectedCellposeResolution: index,
          cellposeArray: newArray
        }
      }
      console.warn(`❌ Invalid resolution index: ${index} (available: 0-${prev.cellposeArrays.length - 1})`)
      return prev
    })
  }, [])

  const value: ZarrStoreContextType = {
    ...state,
    loadStore,
    setSource,
    setZarrPath,
    setCellposePath,
    loadZarrArray,
    loadCellposeData,
    loadFromUrlParams,
    navigateToSuggestion,
    refreshCellposeData,
    setPropertiesCallback,
    setSelectedCellposeResolution
  }

  return (
    <ZarrStoreContext.Provider value={value}>
      {children}
    </ZarrStoreContext.Provider>
  )
}
