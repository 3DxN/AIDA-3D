// Version: 1.3.5 - Hybrid Path Resolution
'use client'

import React, { 
    createContext, useContext,
    useState, useCallback
} from 'react'
import * as zarrita from 'zarrita'

import * as omeUtils from '../utils/ome'

import { 
  ZarrStoreSuggestionType, type ZarrStoreSuggestedPath,
  type ZarrStoreContextType, type ZarrStoreState, type ZarrStoreProviderProps 
} from '../../types/store'
import type OMEAttrs from '../../types/metadata/ome'
import type { AxisKey, IMultiscaleInfo, MultiscaleShape } from '../../types/metadata/loader'


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
    labelServerRoot: '', 
    availableCellposePaths: [],
    userLabelPaths: [],
    hasLoadedArray: false,
    suggestedPaths: [],
    suggestionType: ZarrStoreSuggestionType.NO_OME,
    onPropertiesFound: undefined,
    cellposeProperties: null
  })

  // 1. UTILITIES
  const setSource = useCallback((url: string) => {
    setState(prev => ({ ...prev, source: url }))
  }, [])

  const addUserLabelPath = useCallback((path: string) => {
    setState(prev => ({
      ...prev,
      userLabelPaths: Array.from(new Set([...prev.userLabelPaths, path]))
    }))
  }, [])

  const removeUserLabelPath = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      userLabelPaths: prev.userLabelPaths.filter((_, i) => i !== index)
    }))
  }, [])

  const fetchDirectoryListing = useCallback(async (path: string): Promise<any[]> => {
    if (!state.source) return [];
    try {
      const baseUrl = state.source.replace(/\/$/, '');
      const url = `${baseUrl}/api/ls?path=${encodeURIComponent(path)}`;
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return [];
      const data = await response.json();
      return data.folders || [];
    } catch (e) {
      return [];
    }
  }, [state.source]);

  const setZarrPath = useCallback((path: string) => {
    setState(prev => ({ ...prev, zarrPath: path }))
  }, [])

  const setCellposePath = useCallback((path: string) => {
    setState(prev => ({ ...prev, cellposePath: path }))
  }, [])

  // 2. INTERNAL HELPERS
  const openGroupFromPath = useCallback(async (path: string, baseStore?: zarrita.FetchStore): Promise<zarrita.Group<zarrita.FetchStore> | null> => {
    try {
      let location;
      if (path.startsWith('http://') || path.startsWith('https://')) {
        const store = new zarrita.FetchStore(path);
        location = zarrita.root(store);
      } else {
        if (!baseStore) return null;
        location = zarrita.root(baseStore).resolve(path);
      }
      
      try {
          return await zarrita.open(location, { kind: 'group' }) as zarrita.Group<zarrita.FetchStore>;
      } catch {
          // V3 Probing
          return await zarrita.open(location.resolve('zarr.json'), { kind: 'group' }) as zarrita.Group<zarrita.FetchStore>;
      }
    } catch (e) {
      return null;
    }
  }, []);

  const detectCellposeArray = useCallback(
    async (cellposePath: string, providedStore?: zarrita.FetchStore): Promise<{
      arrays: zarrita.Array<zarrita.Uint32>[],
      resolutions: string[],
      scales: number[][],
      defaultArray: zarrita.Array<zarrita.Uint32> | null
    }> => {
      if (!cellposePath) return { arrays: [], resolutions: [], scales: [], defaultArray: null };

      try {
        const cellposeGroup = await openGroupFromPath(cellposePath, providedStore || state.store || undefined);

        if (cellposeGroup instanceof zarrita.Group) {
          // 🛡️ ISSUE 4: Null Guard Safety for Attrs
          const rawAttrs = cellposeGroup?.attrs ?? {};
          const lAttrs = rawAttrs?.multiscales ? rawAttrs : (rawAttrs?.ome || rawAttrs?.attributes || rawAttrs || {});
          
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
    }, [state.store, openGroupFromPath]
  )

  // 3. CORE LOADING
  const loadFromUrlParams = useCallback(async (serverUrl: string, zarrPath: string, cellposePath: string) => {
    console.log(`📂 Opening: ${serverUrl} / ${zarrPath}`);
    
    // 🛡️ LIVE RELOAD: Reset state to flush ghost data
    setState(prev => ({ 
        ...prev, 
        isLoading: true, isCellposeLoading: true, 
        error: null, source: serverUrl, hasLoadedArray: false, msInfo: null 
    }));

    try {
      const imageStore = new zarrita.FetchStore(serverUrl);
      const rootGroup = zarrita.root(imageStore);
      
      if (!zarrPath || zarrPath === '/') {
          setState(prev => ({ ...prev, isLoading: false, isCellposeLoading: false, store: imageStore, zarrPath: '' }));
          return;
      }

      // Probing Open
      let node;
      try {
          try {
              node = await zarrita.open(rootGroup.resolve(zarrPath));
          } catch (e) {
              // Fallback for V3
              node = await zarrita.open(rootGroup.resolve(`${zarrPath}/zarr.json`));
          }
      } catch (nodeError) {
          throw new Error("Selected folder is not a valid Zarr dataset.");
      }

      let targetGroup: zarrita.Group<zarrita.FetchStore>;
      let finalZarrPath = zarrPath;

      if (node instanceof zarrita.Array) {
          console.log("ℹ️ Array detected, promoting to parent group");
          const parts = zarrPath.split('/');
          parts.pop();
          finalZarrPath = parts.join('/');
          targetGroup = await openGroupFromPath(finalZarrPath, imageStore) as zarrita.Group<zarrita.FetchStore>;
      } else {
          targetGroup = node as zarrita.Group<zarrita.FetchStore>;
      }

      // 🛡️ ISSUE 4: Null Guard Safety for targetGroup Attrs
      const attrs = (targetGroup?.attrs?.ome ?? targetGroup?.attrs ?? {}) as OMEAttrs;
      
      // Meta injection for FLAIR
      let forcedDtype = 'float32';
      let forcedShape = { z: 1, y: 1, x: 1, c: 1, t: 1 };
      if (serverUrl.includes('FLAIR') || zarrPath.includes('FLAIR')) {
          try {
              const metaUrl = `${serverUrl}/${finalZarrPath}/0/.zarray`.replace(/([^:])\/\//g, '$1/');
              const response = await fetch(metaUrl);
              if (response.ok) {
                  const meta = await response.json();
                  forcedDtype = meta.dtype || 'float32';
                  if (meta.shape) {
                      forcedShape.z = meta.shape[0]; forcedShape.y = meta.shape[1]; forcedShape.x = meta.shape[2];
                  }
              }
          } catch {}
      }

      const multiscales = attrs?.multiscales ? attrs.multiscales[0] : null;
      const availableResolutions = multiscales ? multiscales.datasets.map(d => d.path) : ['0'];
      
      let msInfo: IMultiscaleInfo;
      if (!multiscales) {
          msInfo = { shape: forcedShape, dtype: forcedDtype, resolutions: ['0'], channels: ['Intensity'] } as any;
      } else {
          const axes = multiscales.axes?.map(axis => typeof axis === 'string' ? axis : axis.name) || []
          const lowestResArray = await zarrita.open(targetGroup.resolve(availableResolutions[0]), { kind: 'array' }) as zarrita.Array<zarrita.DataType>
          const shape = axes.reduce((acc: any, axis: string) => {
            acc[axis as AxisKey] = lowestResArray.shape[axes.indexOf(axis)]; return acc;
          }, {} as MultiscaleShape)
          if (!axes.includes('c')) shape.c = 1;
          let availableChannels: string[] = [];
          if (attrs?.omero?.channels) {
            availableChannels = attrs.omero.channels.map((ch: any, idx: number) => ch.label || `Channel ${idx + 1}`);
          } else {
            for (let i = 0; i < (shape.c || 1); i++) availableChannels.push(`Channel ${i + 1}`);
          }
          msInfo = { shape, dtype: lowestResArray.dtype, resolutions: availableResolutions, channels: availableChannels } as IMultiscaleInfo;
      }

      // 🛡️ ISSUE 0: Hybrid Path Resolution
      const labelPaths: string[] = [];
      const commonNames = ['Anatomy', 'Segments', 'Ducts', 'Cellpose'];
      let labelBaseUrl = `${serverUrl}/${finalZarrPath}`; // Default: labels inside the zarr image (LOCAL)

      // Strategy A: Try labels inside the Zarr image (LOCAL pattern)
      for (const name of commonNames) {
        try {
          const relPath = `labels/${name}`;
          const node = await zarrita.open(targetGroup.resolve(relPath), { kind: 'group' });
          if (node) labelPaths.push(relPath);
        } catch {}
      }

      // Strategy B: If nothing found inside, try at HTTP root (REMOTE pattern)
      if (labelPaths.length === 0) {
          console.log("ℹ️ No labels found inside Zarr, probing HTTP root...");
          labelBaseUrl = serverUrl;
          for (const name of commonNames) {
            try {
              const fullUrl = `${serverUrl}/labels/${name}`;
              const testGroup = await openGroupFromPath(fullUrl);
              if (testGroup) labelPaths.push(`labels/${name}`);
            } catch {}
          }
      }

      const activePath = labelPaths.includes(cellposePath) ? cellposePath : 
                         labelPaths.includes('labels/Anatomy') ? 'labels/Anatomy' :
                         labelPaths[0] || '';

      // Load labels using the resolved base URL
      let labelData = { arrays: [], resolutions: [], scales: [], defaultArray: null };
      if (activePath) {
          const fullLabelUrl = `${labelBaseUrl}/${activePath}`;
          labelData = await detectCellposeArray(fullLabelUrl);
      }

      setState(prev => ({
        ...prev,
        store: imageStore, root: targetGroup, zarrPath: finalZarrPath,
        labelServerRoot: labelBaseUrl, // Store resolved base for live set switching
        omeData: attrs, msInfo, hasLoadedArray: true,
        availableCellposePaths: labelPaths,
        cellposePath: activePath,
        cellposeArray: labelData.defaultArray,
        cellposeArrays: labelData.arrays,
        cellposeResolutions: labelData.resolutions,
        cellposeScales: labelData.scales,
        selectedCellposeOverlayResolution: 0,
        selectedCellposeMeshResolution: 0,
        isCellposeLoading: false,
        isLoading: false
      }));

      console.log("✅ LOAD COMPLETE");

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn("⚠️ LOAD FAILED:", msg);
      setState(prev => ({ ...prev, isLoading: false, isCellposeLoading: false, error: msg }));
    }
  }, [detectCellposeArray, openGroupFromPath]);

  // 🛡️ ISSUE 0: Fix live label switching using stored labelServerRoot
  const loadCellposeData = useCallback(async (cellposePath: string) => {
    setState(prev => ({ ...prev, cellposePath, isCellposeLoading: true }))
    try {
      const labelBase = state.labelServerRoot || `${state.source}/${state.zarrPath}`;
      const fullLabelUrl = `${labelBase}/${cellposePath}`;
      const { arrays, resolutions, scales, defaultArray } = await detectCellposeArray(fullLabelUrl)
      setState(prev => ({
        ...prev,
        cellposeArray: defaultArray,
        cellposeArrays: arrays,
        cellposeResolutions: resolutions,
        cellposeScales: scales,
        selectedCellposeOverlayResolution: 0,
        selectedCellposeMeshResolution: 0,
        isCellposeLoading: false
      }))
    } catch (error) {
      setState(prev => ({ ...prev, isCellposeLoading: false }))
    }
  }, [state.labelServerRoot, state.source, state.zarrPath, detectCellposeArray])

  const loadZarrArray = useCallback(async (path: string) => {
    if (!state.source) return;
    await loadFromUrlParams(state.source, path, 'labels/Anatomy');
  }, [state.source, loadFromUrlParams]);

  const setSelectedCellposePath = useCallback(async (path: string) => {
    console.log(`🎯 Switching labels to: ${path}`);
    setCellposePath(path);
    
    // HYBRID SOURCE LOGIC: 
    if (path.toLowerCase().includes('141.147.64.20') || (path.toLowerCase().includes('cellpose') && !path.startsWith('labels/'))) {
        console.log("🌍 Switching to ONLINE Demo Environment...");
        await loadFromUrlParams("http://141.147.64.20:5500", "0", "labels/Cellpose");
    } 
    else if (state.hasLoadedArray) {
        await loadCellposeData(path);
    }
    else {
        await loadFromUrlParams("http://127.0.0.1:5500", "newtask/FLAIR_v05.zarr", path);
    }
  }, [state.hasLoadedArray, loadCellposeData, loadFromUrlParams]);

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
    availableCellposePaths: Array.from(new Set([...state.availableCellposePaths, ...state.userLabelPaths])),
    setSource, setZarrPath, setCellposePath, setSelectedCellposePath,
    addUserLabelPath, removeUserLabelPath, fetchDirectoryListing,
    loadCellposeData, loadFromUrlParams, loadZarrArray, setPropertiesCallback,
    setSelectedCellposeOverlayResolution, setSelectedCellposeMeshResolution,
    loadStore: async () => {}, navigateToSuggestion: async () => {}, refreshCellposeData: async () => {}
  }

  return <ZarrStoreContext.Provider value={value}>{children}</ZarrStoreContext.Provider>
}
