# H&E Canvas Post-Processing Integration

## Overview

H&E staining has been integrated as a **post-processing step** that applies pixel-level H&E color mixing to the rendered canvas in real-time.

## How It Works

### The Pipeline

```
1. Viv renders channels with color assignment → Canvas with green/red pixels
2. requestAnimationFrame triggers → Canvas is read
3. Pixel data is extracted → nucleus (green) and cytoplasm (red) channels
4. mixChannelsToHEStain() blends them → H&E stain unmixing
5. Mixed RGB written back → Canvas updated with H&E colors
6. Display shows proper H&E pseudo-coloring
```

### Key Components

**`canvasHEStainProcessor.ts`**:
- `applyHEStainToCanvas()` - Main function that reads canvas, mixes channels, writes back
- `extractChannelsFromRGBA()` - Extracts nucleus (green) and cytoplasm (red) from rendered pixels
- `writeHERGBToCanvas()` - Writes H&E mixed RGB back to canvas
- `setupCanvasHEProcessing()` - Hook wrapper for use in React components

**Integration Point**: `VivViewerWrapper.tsx`
- Detects canvas element inside container
- Sets up H&E processing when `navigationState.heStainingOn === true`
- Automatically cleans up when disabled

## How the Extraction Works

The current implementation assumes:
- **Nucleus channel** is rendered as **green [0, 255, 0]** by Viv
- **Cytoplasm channel** is rendered as **red [255, 0, 0]** by Viv

From the RGBA pixel data, we extract:
```typescript
nucleusData[i] = green channel intensity
cytoplasmData[i] = red channel intensity
```

Then we apply H&E mixing:
```
For each pixel:
  - High nucleus, low cytoplasm → Hematoxylin (blue-purple)
  - Low nucleus, high cytoplasm → Eosin (pink-red)
  - High nucleus, high cytoplasm → Mixed (mauve/purple)
  - Low both → Background (white)
```

## Performance Considerations

### Current Implementation
- Uses `requestAnimationFrame` for continuous processing
- Reads entire canvas every frame (can be expensive)
- Processes every pixel with H&E algorithm

### Optimization Ideas (Future)
- Process only dirty regions (where data changed)
- Use WebGL shader for GPU acceleration
- Cache processed regions
- Throttle updates based on zoom level

## Testing

To test H&E post-processing:

1. Load a Zarr image with two channels
2. Assign channels to Nucleus and Cytoplasm
3. Open Browser DevTools → Console
4. Toggle H&E Staining ON in Navigation Controls
5. Look for console messages:
   - `🎨 Color generation:` - Shows decision logic
   - `👍 Nucleus H&E color` - Confirming H&E is enabled
   - `✅ H&E staining applied to canvas` - Post-processor working

### Expected Visual Changes

**Before H&E (false-color)**:
- Nucleus: Green [0, 255, 0]
- Cytoplasm: Red [255, 0, 0]
- Overlap: Yellow

**After H&E (post-processing)**:
- Nucleus: Blue-purple [163, 20, 204]
- Cytoplasm: Pink-red [54, 25, 10]
- Overlap: Mauve/gray-purple (proper H&E appearance)

## Troubleshooting

### Post-processor not working
**Symptom**: Colors don't change to H&E when toggling ON

**Debug Steps**:
1. Check console for `✅ H&E staining applied to canvas` message
2. If not appearing, check if canvas is being found:
   ```javascript
   const canvas = document.querySelector('.viv-viewer-container canvas')
   console.log('Canvas found:', !!canvas)
   ```
3. Check if `navigationState.heStainingOn` is actually true

### Colors look wrong after H&E
**Possible Causes**:
1. Channel extraction is detecting wrong colors
   - Nucleus might not be green, cytoplasm might not be red
   - Solution: Check what colors Viv is actually rendering

2. H&E color constants might not match your data
   - The Hematoxylin/Eosin colors are optimized for standard H&E
   - Solution: Adjust HE_STAIN_COLORS constants in `channelMixer.ts`

### Performance issues
**Symptom**: Viewer becomes laggy when H&E is ON

**Solutions**:
1. Disable H&E when not needed
2. Monitor frame rate in DevTools → Performance tab
3. Consider GPU acceleration (future enhancement)

## File Changes

- **Created**: `src/lib/utils/canvasHEStainProcessor.ts`
- **Modified**: `src/components/viewer2D/zarr/map/VivViewerWrapper.tsx`
  - Added `useEffect` hook for H&E canvas processing
  - Imported `setupCanvasHEProcessing`

## Architecture Notes

### Why Post-Processing?

We use canvas post-processing instead of modifying the rendering pipeline because:

1. **Viv Integration**: Viv doesn't expose hooks for modifying rendered pixels
2. **Simplicity**: Post-processing is easier than custom PixelSource wrappers
3. **Compatibility**: Works with any Viv version
4. **Flexibility**: Can be toggled on/off in real-time without re-rendering

### Why Not Pre-Render?

Pre-rendering (mixing channels before Viv renders) would require:
- Custom PixelSource that fetches nucleus + cytoplasm data
- Mixing pixels and returning as single RGB channel
- Complex Viv integration and type handling
- Much more computational overhead upfront

Post-processing achieves the same result more efficiently.

## Future Enhancements

1. **GPU Acceleration**: Use WebGL canvas filters or Three.js for fast mixing
2. **Adaptive Processing**: Only process visible tiles
3. **Color Customization**: Allow users to adjust H&E colors in UI
4. **Other Stains**: Support IHC, immunofluorescence, custom stains
5. **Performance Monitoring**: Add timing metrics

## Code Example (Manual Usage)

```typescript
// In a React component with canvas ref
import { setupCanvasHEProcessing } from '@/lib/utils/canvasHEStainProcessor'

function MyComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { navigationState, msInfo } = useViewer2DData()

  useEffect(() => {
    if (!canvasRef.current) return

    return setupCanvasHEProcessing(canvasRef.current, {
      enabled: navigationState.heStainingOn,
      channelMap: navigationState.channelMap,
      dataType: msInfo.dtype as 'uint8' | 'uint16'
    })
  }, [navigationState.heStainingOn, navigationState.channelMap, msInfo.dtype])

  return <canvas ref={canvasRef} />
}
```
