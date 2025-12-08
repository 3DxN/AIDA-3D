# AIDA-3D Copilot Instructions

## Project Overview
AIDA-3D is a React/Next.js web application for 2D and 3D visualization of histology images with semantic segmentation. It combines a 2D image viewer (OpenLayers) with a 3D mesh viewer (Three.js), synchronized through a centralized state management system using Zarr arrays for large-scale scientific image data.

## Architecture Patterns

### Context-Based State Management
The app uses a **multi-context provider hierarchy** (not Redux) for managing global state:
- `ZarrStoreContext` - Core data loading & Zarr array metadata (source of truth for all data)
- `Viewer2DDataContext` - 2D viewer navigation state, frame bounds, view calculations
- `NucleusSelectionContext` - Selected nucleus indices for cross-viewer synchronization
- `NucleusColorContext` - Nucleus coloring/styling across viewers
- `ColorMapContext` - 2D image channel coloring

**Pattern**: All contexts are wrapped in `_app.js` providers. Components use `useXxxContext()` hooks to access state. Never prop-drill - use context hooks directly.

### Data Flow: Zarr Multiscale Images
1. User specifies Zarr store URL → `ZarrStoreContext.setSource()`
2. Context loads multiscale metadata (OME-Zarr format) via `zarrita` library
3. Populates `msInfo` (multiscale info) with dtype, axes, available resolutions
4. `Viewer2DDataContext` receives `msInfo` and initializes default navigation state
5. `ZarrViewer` component renders when `hasLoadedArray && msInfo` are true
6. For Cellpose segmentation: loads all resolution levels into `cellposeArrays[]` for 2D overlay vs. 3D mesh

**Key Files**:
- `src/lib/contexts/ZarrStoreContext.tsx` - Zarr loading, array detection, OME metadata parsing
- `src/lib/contexts/Viewer2DDataContext.tsx` - Frame state, bounds calculations, navigation
- `src/lib/utils/ome.ts` - Type guards and utilities for OME-Zarr structure validation

### Component Structure
- **Page Components** (`src/pages/`): Next.js routes that determine which viewer to show
  - `index.tsx` - Home/loader UI
  - `zarr.tsx` - Zarr-specific entry point
  - `demo.tsx` - Demo mode
- **Viewer Components**:
  - `viewer2D/` - OpenLayers-based 2D viewer with overlays, toolbars, navigation controls
  - `viewer3D/` - Three.js 3D mesh viewer with selection, cross-sections, volume calculations
- **Shared Components**:
  - `interaction/` - Reusable form controls (Slider, ColorPicker, etc.) using React Aria for accessibility
  - `dashboard/` - Data tables and inspection panels
  - `loader/` - Zarr store loading interface

### Type System
Types are organized by feature domain in `src/types/`:
- `viewer2D/` - Navigation state, frame state, viv viewer types
- `metadata/` - OME-Zarr structure types (from `ome.ts`)
- `store.ts` - Zarr context state shape and suggestion types
- **Important**: Always import from typed contexts, not from component props

## Critical Conventions

### Zarr Data Access
- Use `zarrita` library, not raw fetch
- Always check `msInfo` availability before accessing image dimensions/axes
- Cellpose detection finds ALL resolutions: `cellposeArrays[]` (array list) + `cellposeScales[][]` (scale factors)
- Default cellpose path is `labels/Cellpose` but is configurable

### OpenLayers Integration (2D Viewer)
- Map created in `useEffect` because it requires DOM/document object
- Feature parsing uses `parseFeature()` utility with coordinate conversion
- DZI and IIIF image formats supported
- Annotations stored as OpenLayers Features and persisted via `/save` endpoint

### Three.js Integration (3D Viewer)
- Uses `WebGLRenderer` with `RoomEnvironment` lighting
- Meshes generated via marching cubes algorithm from voxel data
- Material cleanup required in `cleanMaterial()` to prevent memory leaks
- Selection state shared via `NucleusSelectionContext` (nucleus indices, not meshes)
- Cross-viewer synchronization: selecting a nucleus in 2D highlights it in 3D and vice versa

### React Aria Components
All interactive controls use React Aria for accessibility:
- `Slider`, `NumberField`, `RangeSlider` with stately hooks
- `Button` from headlessui/react
- Never use native HTML form elements; wrap in Aria components

## Build & Development Workflows

### Local Development
```bash
npm install                    # Install dependencies
npm run dev                    # Start dev server + local data server (concurrently)
```
- Next.js dev server: `http://localhost:3000`
- Local file server: `http://localhost:8000` (configured in `aida.config.ts`)
- HMR enabled for React components

### Production Build
```bash
npm run build                  # Builds Next.js app + compiles local TS to JS
npm start                      # Runs production Next.js + local server
```
- Build errors ignored in `next.config.js` (type errors don't block builds)
- `ol` package requires transpilation via `transpilePackages` in Next.js 15

### Deployment
- PM2 ecosystem file: `ecosystem.config.js`
- Deployed via GitHub Actions → Ubuntu server at `141.147.64.20:3000`
- `deploy.sh` script stops/restarts PM2 process
- Max memory: 1GB per instance

## Data Directory Structure
```
local/data/                  # Default data directory
├── image.json             # Project manifest: { "images": [...], "tiles": "..." }
├── image-dz/              # DeepZoom tiles (2D images)
│   └── image_files/{z}/{x}_{y}.jpeg
└── image-tiles/           # GLTF segmentation meshes
    ├── tile__H000_V000.gltf
    ├── tile__H000_V000.bin
    └── tile__H000_V000.json
```

## Common Patterns to Reuse

### Creating a Context Hook
```tsx
const useMyContext = () => {
  const context = useContext(MyContext);
  if (!context) throw new Error('Must be within MyProvider');
  return context;
};
```

### Accessing Zarr Data
```tsx
const { msInfo, cellposeArrays, cellposeScales } = useZarrStore();
if (!msInfo) return <div>Loading...</div>;
// Use msInfo.shape, msInfo.dtype, msInfo.axes
```

### Computing Frame Bounds in 2D
```tsx
const { frameCenter, frameSize, getFrameBounds } = useViewer2DData();
const bounds = getFrameBounds(); // { left, right, top, bottom }
```

### Handling Metadata Properties from Zarr
The `ZarrStoreContext` can load properties from `zarr.json` attributes. Register a callback:
```tsx
const { setPropertiesCallback } = useZarrStore();
setPropertiesCallback((properties) => {
  // properties is array of objects with 'label-value' and custom fields
});
```

## Red Flags / Things to Avoid

1. **Don't access `frameCenter`/`frameSize` directly in transforms** - use `getFrameBounds()` for consistent bounds calculation
2. **Don't create new Three.js geometries without cleanup** - call `dispose()` on materials and textures
3. **Don't fetch Zarr data without checking `isLoading`/`error` states** - loading states exist in both contexts
4. **Don't assume DZI format** - check file extension; IIIF support also exists
5. **Don't mutate context state directly** - use provided setter functions (e.g., `setNavigationState()`)
6. **Don't ignore TypeScript errors** - strict mode is enabled; types catch real bugs

## Debugging Tips

- **Zarr load failures**: Check browser Network tab for 404s, verify URL format and multiscales structure
- **Frame bounds off**: Verify `frameCenter` and `frameSize` match image dimensions in `msInfo`
- **3D mesh doesn't appear**: Check if Cellpose array loaded successfully, verify scale factors
- **Slow performance**: Check Chrome DevTools for redundant re-renders; verify `useMemo`/`useCallback` dependencies
- **Missing properties in 3D**: Ensure `setPropertiesCallback` is called before mesh generation

## Key Files to Study
- `src/lib/contexts/ZarrStoreContext.tsx` - Entry point for understanding data loading
- `src/components/viewer2D/zarr/index.tsx` - How Zarr viewer initialized
- `src/components/viewer3D/index.tsx` - Synchronization patterns between viewers
- `src/lib/utils/ome.ts` - OME-Zarr validation and metadata parsing
