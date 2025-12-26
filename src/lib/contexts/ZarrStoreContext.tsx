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
    selectedCellposeOverlayResolution: 0,
    selectedCellposeMeshResolution: 3,
    isCellposeLoading: false,
    cellposeError: null,
    isLoading: false,
    error: null,
    infoMessage: null,
    source: initialSource,
    zarrPath: initialZarrPath,
    cellposePath: initialCellposePath,
    availableCellposePaths: [],
    hasLoadedArray: false,
    suggestedPaths: [],
    suggestionType: ZarrStoreSuggestionType.NO_OME,
    onPropertiesFound: undefined,
    cellposeProperties: null
  })

  // 1. UTILITIES (Define first)
  const setSource = useCallback((url: string) => {
    setState(prev => ({ ...prev, source: url }))
  }, [])

  const setZarrPath = useCallback((path: string) => {
    setState(prev => ({ ...prev, zarrPath: path }))
  }, [])

  const setCellposePath = useCallback((path: string) => {
    setState(prev => ({ ...prev, cellposePath: path }))
  }, [])

  const detectCellposeArray = useCallback(
    async (cellposePath: string): Promise<{
      arrays: zarrita.Array<zarrita.Uint32>[],
      resolutions: string[],
      scales: number[][],
      defaultArray: zarrita.Array<zarrita.Uint32> | null
    }> => {
      if (!state.store || !cellposePath) return { arrays: [], resolutions: [], scales: [], defaultArray: null };

      try {
        // FIX: Use relative resolution to stay inside the FLAIR scan folder
        const location = state.root ? state.root.resolve(cellposePath) : zarrita.root(state.store).resolve(cellposePath);
        
        let cellposeGroup: zarrita.Group<zarrita.FetchStore>;
        try {
            cellposeGroup = await zarrita.open(location, { kind: 'group' }) as zarrita.Group<zarrita.FetchStore>;
        } catch (e) {
            // Fallback for parent resolution
            if (state.root && !cellposePath.startsWith('..')) {
                cellposeGroup = await zarrita.open(state.root.resolve(`../${cellposePath}`), { kind: 'group' }) as zarrita.Group<zarrita.FetchStore>;
            } else {
                throw e;
            }
        }

        if (cellposeGroup instanceof zarrita.Group) {
          const rawAttrs = cellposeGroup.attrs as any;
          const lAttrs = rawAttrs?.multiscales ? rawAttrs : (rawAttrs?.ome || rawAttrs?.attributes || rawAttrs);
          
          const multiscales = lAttrs?.multiscales;
          if (multiscales && multiscales[0]?.datasets?.length > 0) {
            const arrays: zarrita.Array<zarrita.Uint32>[] = []
            const resolutions: string[] = []
            const scales: number[][] = []

            for (const dataset of multiscales[0].datasets) {
              try {
                const array = await zarrita.open(cellposeGroup.resolve(dataset.path), { kind: 'array' })
                if (array instanceof zarrita.Array) {
                  arrays.push(array as zarrita.Array<zarrita.Uint32>)
                  resolutions.push(dataset.path)
                  const baseShape = arrays[0].shape;
                  const curShape = array.shape;
                  scales.push(baseShape.map((dim, i) => curShape[i] > 0 ? dim / curShape[i] : 1.0));
                }
              } catch {}
            }
            return { arrays, resolutions, scales, defaultArray: arrays[0] || null }
          }
        }
        return { arrays: [], resolutions: [], scales: [], defaultArray: null }
      } catch (error) {
        return { arrays: [], resolutions: [], scales: [], defaultArray: null }
      }
    }, [state.store, state.root]
  )

  // 2. LOADING LOGIC
  const loadCellposeData = useCallback(async (cellposePath: string) => {
    if (!state.store) return
    setState(prev => ({ ...prev, cellposePath, isCellposeLoading: true }))
    try {
      const { arrays, resolutions, scales, defaultArray } = await detectCellposeArray(cellposePath)
      setState(prev => ({
        ...prev,
        cellposeArray: defaultArray,
        cellposeArrays: arrays,
        cellposeResolutions: resolutions,
        cellposeScales: scales,
        selectedCellposeOverlayResolution: 0,
        selectedCellposeMeshResolution: Math.min(3, arrays.length - 1),
        isCellposeLoading: false
      }))
    } catch (error) {
      setState(prev => ({ ...prev, isCellposeLoading: false }))
    }
  }, [state.store, detectCellposeArray])

  const setSelectedCellposePath = useCallback(async (path: string) => {
    console.log(`🎯 Switching labels to: ${path}`);
    setCellposePath(path);
    await loadCellposeData(path);
  }, [setCellposePath, loadCellposeData])

  const processGroup = useCallback(async (grp: zarrita.Group<zarrita.FetchStore>) => {
    const attrs = (grp.attrs?.ome ?? grp.attrs) as OMEAttrs
    if (omeUtils.isOmeMultiscales(attrs)) {
      const multiscales = attrs.multiscales![0]
      const availableResolutions = multiscales.datasets.map(dataset => dataset.path)
      const axes = multiscales.axes?.map(axis => typeof axis === 'string' ? axis : axis.name) || []
      const lowestResArray = await zarrita.open(grp.resolve(availableResolutions[0]), { kind: 'array' }) as zarrita.Array<zarrita.DataType>
      
      const shape = axes.reduce((acc, axis) => {
        acc[axis as AxisKey] = lowestResArray.shape[axes.indexOf(axis)]
        return acc
      }, {} as MultiscaleShape)

      // Fallback for MRI: Default to 1 channel if 'c' is not in axes
      if (!axes.includes('c')) shape.c = 1;

      // Generate channel labels if omero metadata is missing
      let availableChannels: string[] = [];
      if (attrs.omero?.channels) {
        availableChannels = attrs.omero.channels.map((ch: any, idx: number) => ch.label || `Channel ${idx + 1}`);
      } else {
        for (let i = 0; i < (shape.c || 1); i++) availableChannels.push(`Channel ${i + 1}`);
      }

      const msInfo = { shape, dtype: lowestResArray.dtype, resolutions: availableResolutions, channels: availableChannels } as IMultiscaleInfo;
      setState(prev => ({ ...prev, omeData: attrs, msInfo, hasLoadedArray: true }))
    }
  }, [])

  const loadFromUrlParams = useCallback(async (serverUrl: string, zarrPath: string, cellposePath: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, isCellposeLoading: true }))
      const store = new zarrita.FetchStore(serverUrl)
      const rootGroup = zarrita.root(store)
      const targetGroup = await zarrita.open(rootGroup.resolve(zarrPath), { kind: 'group' }) as zarrita.Group<zarrita.FetchStore>
      
      // 1. Load Main Image
      // Re-implement processGroup logic locally to ensure we have 'attrs' for state update
      const attrs = (targetGroup.attrs?.ome ?? targetGroup.attrs) as OMEAttrs
      if (!omeUtils.isOmeMultiscales(attrs)) throw new Error("No multiscales");

      const multiscales = attrs.multiscales![0]
      const availableResolutions = multiscales.datasets.map(dataset => dataset.path)
      const axes = multiscales.axes?.map(axis => typeof axis === 'string' ? axis : axis.name) || []
      const lowestResArray = await zarrita.open(targetGroup.resolve(availableResolutions[0]), { kind: 'array' }) as zarrita.Array<zarrita.DataType>
      
      const shape = axes.reduce((acc: any, axis: string) => {
        acc[axis as AxisKey] = lowestResArray.shape[axes.indexOf(axis)]
        return acc
      }, {} as MultiscaleShape)

      if (!axes.includes('c')) shape.c = 1;

      let availableChannels: string[] = [];
      if (attrs.omero?.channels) {
        availableChannels = attrs.omero.channels.map((ch: any, idx: number) => ch.label || `Channel ${idx + 1}`);
      } else {
        for (let i = 0; i < (shape.c || 1); i++) availableChannels.push(`Channel ${i + 1}`);
      }

      const msInfo = { shape, dtype: lowestResArray.dtype, resolutions: availableResolutions, channels: availableChannels } as IMultiscaleInfo;

      // 2. Discover Labels
      const labelPaths: string[] = [];
      const commonNames = ['Anatomy', 'Segments', 'Cellpose', 'Ducts'];
      
      for (const name of commonNames) {
        // Try resolving from targetGroup (e.g. root/labels/Anatomy)
        try {
          const testLoc = targetGroup.resolve(`labels/${name}`);
          const node = await zarrita.open(testLoc, { kind: 'group' });
          if (node) {
             labelPaths.push(`labels/${name}`);
             continue; 
          }
        } catch {}

        // Try resolving from parent (e.g. root/0 -> ../labels/Anatomy)
        try {
          const testLoc = targetGroup.resolve(`../labels/${name}`);
          const node = await zarrita.open(testLoc, { kind: 'group' });
          if (node) labelPaths.push(`../labels/${name}`);
        } catch {}
      }

      // Default if nothing found (to populate UI)
      if (labelPaths.length === 0) {
          labelPaths.push('../labels/Anatomy');
          labelPaths.push('../labels/Segments');
      }

      const activeLabelPath = labelPaths.includes(cellposePath) ? cellposePath : 
                              labelPaths.includes(`../${cellposePath}`) ? `../${cellposePath}` :
                              labelPaths[0];

      // 3. Load Labels
      let labelData: any = { arrays: [], resolutions: [], scales: [], defaultArray: null, properties: null };
      
      if (activeLabelPath) {
        try {
          const cellposeGroup = await zarrita.open(targetGroup.resolve(activeLabelPath), { kind: 'group' }) as zarrita.Group<zarrita.FetchStore>;
          const rawAttrs = cellposeGroup.attrs as any;
          let lAttrs: any = rawAttrs?.multiscales ? rawAttrs : (rawAttrs?.ome || rawAttrs?.attributes || rawAttrs);
          
          if (lAttrs?.['image-label']?.properties) {
            labelData.properties = lAttrs['image-label'].properties;
          }

          const multiscalesAttr = lAttrs?.multiscales?.[0];
          if (multiscalesAttr?.datasets) {
            for (const dataset of multiscalesAttr.datasets) {
              try {
                const arr = await zarrita.open(cellposeGroup.resolve(dataset.path), { kind: 'array' }) as zarrita.Array<zarrita.Uint32>;
                if (arr instanceof zarrita.Array) {
                  labelData.arrays.push(arr);
                  labelData.resolutions.push(dataset.path);
                  const base = labelData.arrays[0].shape;
                  const cur = arr.shape;
                  labelData.scales.push(base.map((d, i) => cur[i] > 0 ? d / cur[i] : 1.0));
                }
              } catch {}
            }
            labelData.defaultArray = labelData.arrays[0] || null;
          }
        } catch (e) {
            console.warn('Failed to load initial label set:', e);
        }
      }

      // 4. Update State
      setState(prev => {
        if (labelData.properties && prev.onPropertiesFound) {
          try { prev.onPropertiesFound(labelData.properties) } catch {}
        }
        return {
          ...prev,
          store, root: targetGroup, zarrPath,
          omeData: attrs,
          msInfo,
          hasLoadedArray: true,
          availableCellposePaths: labelPaths,
          cellposePath: activeLabelPath,
          cellposeArray: labelData.defaultArray,
          cellposeArrays: labelData.arrays,
          cellposeResolutions: labelData.resolutions,
          cellposeScales: labelData.scales,
          cellposeProperties: labelData.properties,
          selectedCellposeOverlayResolution: 0,
          selectedCellposeMeshResolution: Math.min(3, labelData.arrays.length - 1),
          isCellposeLoading: false,
          isLoading: false
        };
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({ ...prev, error: `Failed to load: ${errorMessage}`, isLoading: false, isCellposeLoading: false }))
    }
  }, [detectCellposeArray])

  // 3. MISC
  const setPropertiesCallback = useCallback((callback: (properties: any[]) => void) => {
    setState(prev => ({ ...prev, onPropertiesFound: callback }))
  }, [])

  const setSelectedCellposeOverlayResolution = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedCellposeOverlayResolution: index }))
  }, [])

  const setSelectedCellposeMeshResolution = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedCellposeMeshResolution: index }))
  }, [])

  const value: ZarrStoreContextType = {
    ...state,
    setSource, setZarrPath, setCellposePath, setSelectedCellposePath,
    loadCellposeData, loadFromUrlParams, setPropertiesCallback,
    setSelectedCellposeOverlayResolution, setSelectedCellposeMeshResolution,
    loadStore: async () => {}, loadZarrArray: async () => {}, navigateToSuggestion: async () => {}, refreshCellposeData: async () => {}
  }

  return <ZarrStoreContext.Provider value={value}>{children}</ZarrStoreContext.Provider>
}
