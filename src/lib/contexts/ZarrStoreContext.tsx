// Version: 1.8.0 - URL Deduplication + Path Normalization
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
      
      return await zarrita.open(location, { kind: 'group' }) as zarrita.Group<zarrita.FetchStore>;
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

      // 🛡️ CRITICAL FIX: Deduplicate any doubled paths in the URL
      let normalizedPath = cellposePath;
      if (normalizedPath.startsWith('http')) {
        try {
          const url = new URL(normalizedPath);
          const pathParts = url.pathname.split('/').filter(Boolean);

          // Look for patterns like "newtask/FLAIR_v05.zarr/newtask/FLAIR_v05.zarr"
          for (let i = 0; i < pathParts.length - 1; i++) {
            const remaining = pathParts.slice(i);
            const half = Math.floor(remaining.length / 2);
            if (half >= 2) { // Need at least 2 parts to form a meaningful duplicate
              const first = remaining.slice(0, half).join('/');
              const second = remaining.slice(half, half * 2).join('/');
              if (first === second) {
                // Found doubled path, remove the duplicate
                pathParts.splice(i, half);
                url.pathname = '/' + pathParts.join('/');
                normalizedPath = url.toString();
                console.log(`🔧 Fixed doubled path: ${normalizedPath}`);
                break;
              }
            }
          }
        } catch (e) {
          console.warn('URL parsing failed:', e);
        }
      }

      try {
        let multiscales: any = null;

        // 🛡️ FIX: For HTTP paths, manually fetch zarr.json to bypass broken V3 detection in zarrita
        if (normalizedPath.startsWith('http')) {
            const zarrJsonUrl = `${normalizedPath.replace(/\/$/, '')}/zarr.json`;
            console.log(`🔍 Manually fetching: ${zarrJsonUrl}`);
            const response = await fetch(zarrJsonUrl);
            if (!response.ok) return { arrays: [], resolutions: [], scales: [], defaultArray: null };
            
            const metadata = await response.json();
            const attrs = metadata.attributes || {};
            const omeAttrs = attrs.multiscales ? attrs : (attrs.ome || attrs);
            multiscales = omeAttrs?.multiscales?.[0];
        } else {
            const cellposeGroup = await openGroupFromPath(normalizedPath, providedStore || state.store || undefined);
            if (cellposeGroup instanceof zarrita.Group) {
                const rawAttrs = cellposeGroup?.attrs ?? {};
                const lAttrs = rawAttrs?.multiscales ? rawAttrs : (rawAttrs?.ome || rawAttrs?.attributes || rawAttrs || {});
                multiscales = lAttrs?.multiscales?.[0];
            }
        }

        if (!multiscales?.datasets?.length) {
            return { arrays: [], resolutions: [], scales: [], defaultArray: null };
        }

        // Load arrays from datasets
        const arrays: zarrita.Array<zarrita.Uint32>[] = [];
        const resolutions: string[] = [];
        const scales: number[][] = [];

        for (const dataset of multiscales.datasets) {
          try {
            let array: zarrita.Array<zarrita.DataType>;
            if (normalizedPath.startsWith('http')) {
                const arrayUrl = `${normalizedPath.replace(/\/$/, '')}/${dataset.path}`;

                // 🛡️ FIX: Pre-fetch array zarr.json to confirm V3 before zarrita.open
                // This prevents zarrita from spamming V2 probes (.zattrs, .zarray)
                const arrayMetaUrl = `${arrayUrl}/zarr.json`;
                const metaResponse = await fetch(arrayMetaUrl);
                if (!metaResponse.ok) {
                    console.warn(`⚠️ No zarr.json at ${arrayMetaUrl}`);
                    continue;
                }

                const arrayStore = new zarrita.FetchStore(arrayUrl);
                array = await zarrita.open(zarrita.root(arrayStore), { kind: 'array' }) as zarrita.Array<zarrita.DataType>;
            } else {
                const cellposeGroup = await openGroupFromPath(normalizedPath, providedStore || state.store || undefined);
                if (!cellposeGroup) continue;
                array = await zarrita.open(cellposeGroup.resolve(dataset.path), { kind: 'array' }) as zarrita.Array<zarrita.DataType>;
            }

            if (array instanceof zarrita.Array) {
              arrays.push(array as zarrita.Array<zarrita.Uint32>);
              resolutions.push(dataset.path);
              const baseShape = arrays[0]?.shape || array.shape;
              const curShape = array.shape;
              scales.push(baseShape.map((dim, i) => curShape[i] > 0 ? dim / curShape[i] : 1.0));
            }
          } catch (e) {
            console.warn(`⚠️ Failed to open array ${dataset.path}:`, e);
          }
        }

        return { arrays, resolutions, scales, defaultArray: arrays[0] || null };
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
                  if (meta.shape && meta.shape.length > 0) {
                      // 🛡️ FIX: Handle different shape lengths correctly
                      // Shape order is typically: [..., z, y, x] (last 3 are spatial)
                      const s = meta.shape;
                      forcedShape.x = s[s.length - 1] || 1;
                      forcedShape.y = s[s.length - 2] || 1;
                      forcedShape.z = s[s.length - 3] || 1;
                      if (s.length >= 4) forcedShape.c = s[s.length - 4] || 1;
                      if (s.length >= 5) forcedShape.t = s[s.length - 5] || 1;
                      console.log(`📏 FLAIR shape extracted: ${JSON.stringify(forcedShape)} from ${JSON.stringify(s)}`);
                  }
              }
          } catch (e) {
              console.warn('⚠️ Failed to fetch FLAIR .zarray metadata:', e);
          }
      }

      const multiscales = attrs?.multiscales ? attrs.multiscales[0] : null;
      const availableResolutions = multiscales ? multiscales.datasets.map(d => d.path) : ['0'];

      let msInfo: IMultiscaleInfo;
      if (!multiscales) {
          console.log('⚠️ No multiscales metadata, using forced shape:', forcedShape);
          msInfo = { shape: forcedShape, dtype: forcedDtype, resolutions: ['0'], channels: ['Intensity'] } as any;
      } else {
          const axes = multiscales.axes?.map((axis: any) => typeof axis === 'string' ? axis : axis.name) || []
          const axisTypes = multiscales.axes?.map((axis: any) => typeof axis === 'string' ? null : axis.type) || []
          console.log('📐 OME-Zarr axes:', axes, 'types:', axisTypes);
          const lowestResArray = await zarrita.open(targetGroup.resolve(availableResolutions[0]), { kind: 'array' }) as zarrita.Array<zarrita.DataType>
          console.log('📦 Array shape:', lowestResArray.shape, 'dtype:', lowestResArray.dtype);

          // 🛡️ FIX: Use axis POSITION for spatial dimensions, not just names
          // OME-Zarr convention: spatial axes are ordered [..., z, y, x] (x is always LAST spatial)
          const arrShape = lowestResArray.shape;
          const shape: MultiscaleShape = { t: 1, c: 1, z: 1, y: 1, x: 1 };

          // First pass: identify non-spatial axes (time, channel) by type or name
          const spatialIndices: number[] = [];
          axes.forEach((axis: string, idx: number) => {
            const axisLower = axis.toLowerCase();
            const axisType = axisTypes[idx];
            if (axisType === 'time' || axisLower === 't') {
              shape.t = arrShape[idx];
            } else if (axisType === 'channel' || axisLower === 'c') {
              shape.c = arrShape[idx];
            } else {
              // Spatial axis - collect for position-based assignment
              spatialIndices.push(idx);
            }
          });

          // Second pass: assign spatial dimensions by POSITION (last = x, second-to-last = y, third-to-last = z)
          // This is robust regardless of axis naming (x/y/z or whatever)
          if (spatialIndices.length >= 1) {
            shape.x = arrShape[spatialIndices[spatialIndices.length - 1]]; // Last spatial = X
          }
          if (spatialIndices.length >= 2) {
            shape.y = arrShape[spatialIndices[spatialIndices.length - 2]]; // Second-to-last = Y
          }
          if (spatialIndices.length >= 3) {
            shape.z = arrShape[spatialIndices[spatialIndices.length - 3]]; // Third-to-last = Z
          }

          console.log('📏 Mapped shape:', shape, `(from ${spatialIndices.length} spatial axes)`);

          let availableChannels: string[] = [];
          if (attrs?.omero?.channels) {
            availableChannels = attrs.omero.channels.map((ch: any, idx: number) => ch.label || `Channel ${idx + 1}`);
          } else {
            for (let i = 0; i < (shape.c || 1); i++) availableChannels.push(`Channel ${i + 1}`);
          }
          msInfo = { shape, dtype: lowestResArray.dtype, resolutions: availableResolutions, channels: availableChannels } as IMultiscaleInfo;
          console.log('✅ msInfo created:', { shape: msInfo.shape, dtype: msInfo.dtype, channels: msInfo.channels.length });
      }

      // 🛡️ ISSUE 0: Hybrid Path Resolution
      const labelPaths: string[] = [];
      const commonNames = ['Anatomy', 'Segments', 'Ducts', 'Cellpose'];
      let labelBaseUrl = `${serverUrl}/${finalZarrPath}`; 

      // Strategy A: Local check
      for (const name of commonNames) {
        try {
          const relPath = `labels/${name}`;
          const node = await zarrita.open(targetGroup.resolve(relPath), { kind: 'group' });
          if (node) labelPaths.push(relPath);
        } catch {}
      }

      // Strategy B: 🛡️ FIX: Manual zarr.json check for remote discovery
      if (labelPaths.length === 0) {
          console.log("ℹ️ Probing remote HTTP root for labels...");
          labelBaseUrl = serverUrl;
          for (const name of commonNames) {
            try {
              const fullUrl = `${serverUrl}/labels/${name}`;
              const response = await fetch(`${fullUrl}/zarr.json`);
              if (response.ok) {
                  const metadata = await response.json();
                  if (metadata.zarr_format === 3) {
                      console.log(`✅ Found V3 label: ${fullUrl}`);
                      labelPaths.push(`labels/${name}`);
                  }
              }
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
        labelServerRoot: labelBaseUrl, 
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

  const loadCellposeData = useCallback(async (cellposePath: string) => {
    setState(prev => ({ ...prev, cellposePath, isCellposeLoading: true }))
    try {
      const labelBase = state.labelServerRoot || `${state.source}/${state.zarrPath}`;

      // 🛡️ FIX: Normalize path - strip zarrPath prefix if present to prevent doubling
      let normalizedPath = cellposePath;
      if (state.zarrPath && cellposePath.startsWith(state.zarrPath)) {
        normalizedPath = cellposePath.slice(state.zarrPath.length).replace(/^\//, '');
      }
      // Also handle if path contains zarrPath in the middle
      if (state.zarrPath && normalizedPath.includes(state.zarrPath)) {
        const parts = normalizedPath.split(state.zarrPath);
        normalizedPath = parts[parts.length - 1].replace(/^\//, '');
      }

      const fullLabelUrl = `${labelBase}/${normalizedPath}`;
      console.log(`🔗 Loading labels from: ${fullLabelUrl}`);

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
    
    if (path.includes('141.147.64.20')) {
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