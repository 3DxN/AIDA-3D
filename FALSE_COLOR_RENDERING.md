# False-Color Channel Mixing Implementation

## Overview
Added a false-color rendering system that combines nucleus and cytoplasm channels into a single RGB composite image using the standard biological false-color scheme:
- **Nucleus** → **Green** channel
- **Cytoplasm** → **Red** channel
- **Overlap (both channels)** → **Yellow** (R + G)

## Architecture

### 1. Channel Mixer Utility (`src/lib/utils/channelMixer.ts`)

Core functions for channel mixing:

#### `mixChannelsToRGB()`
Combines two channel arrays (nucleus and cytoplasm) into interleaved RGB output.

```typescript
const rgb = mixChannelsToRGB(nucleusData, cytoplasmData, 65535, 65535)
// Returns: Uint8Array with [R, G, B, R, G, B, ...] values
```

**Parameters:**
- `nucleusData`: Uint8Array or Uint16Array of nucleus pixel values
- `cytoplasmData`: Uint8Array or Uint16Array of cytoplasm pixel values
- `nucleusScale`: Scale factor for normalization (e.g., 65535 for uint16)
- `cytoplasmScale`: Scale factor for normalization (e.g., 65535 for uint16)

**Output:**
- Red (R) channel = normalized cytoplasm values (0-255)
- Green (G) channel = normalized nucleus values (0-255)
- Blue (B) channel = 0 (unused)

#### `createChannelMixer()`
Factory function that creates a mixer configuration based on channel map.

```typescript
const mixer = createChannelMixer(channelMap, 'uint16')
if (mixer.hasNucleus && mixer.hasCytoplasm) {
  const rgb = mixer.mix({
    0: nucleusChannelData,
    1: cytoplasmChannelData
  })
}
```

#### `shouldUseFalseColor()`
Determines if both nucleus and cytoplasm are selected.

```typescript
if (shouldUseFalseColor(channelMap)) {
  // Use false-color rendering
}
```

#### `getRenderingMode()`
Returns the current rendering mode based on selection.

```typescript
const mode = getRenderingMode(channelMap) // 'single' | 'dual'
```

### 2. Color Generation in useVivViewer

Updated color assignment logic to respect false-color scheme:

```typescript
const colors = useMemo(() => {
  if (useFalseColor) {
    if (role === 'nucleus') {
      return [0, 255, 0]  // Green
    } else if (role === 'cytoplasm') {
      return [255, 0, 0]  // Red
    }
  }
  // ... fallback colors
}, [navigationState.channelMap])
```

**Behavior:**
- When **both nucleus and cytoplasm selected**: Uses fixed colors (green/red) regardless of order
- When **single channel selected**: Uses default colors based on role order

### 3. Layer Props Metadata

Extended `VivLayerProps` interface to include false-color information:

```typescript
export interface VivLayerProps {
  // ... existing properties ...
  falseColorMode?: {
    enabled: boolean;                    // True if dual-channel rendering
    renderingMode: 'single' | 'dual';    // Current mode
    nucleusChannelIndex?: number | null; // Actual channel index
    cytoplasmChannelIndex?: number | null; // Actual channel index
  };
}
```

This metadata allows overlay components and post-processing layers to:
- Know when false-color rendering is active
- Access the channel indices being rendered
- Optionally apply custom mixing logic

## Usage Example

### Single Channel (Nucleus only)
```
Channel Map: { nucleus: 2, cytoplasm: null }
Rendering: Green channel with nucleus data
```

### Dual Channel False-Color
```
Channel Map: { nucleus: 0, cytoplasm: 1 }
Rendering: 
- Red = cytoplasm intensity
- Green = nucleus intensity  
- Yellow regions = colocalization
```

### Switching Channels
```
User selects nucleus: Channel 2, cytoplasm: Channel 3
→ Colors update: nucleus stays green, cytoplasm stays red
→ Viv re-renders with new selections
```

## Visual Result

### Before (All channels rendered separately with different colors)
```
Channel 0 (nuclei): displayed as one color
Channel 1 (cytoplasm): displayed as another color
→ Difficult to see colocalization
```

### After (False-color composite when both selected)
```
Channel 0 (nucleus): Green
Channel 1 (cytoplasm): Red
Overlap: Yellow
→ Intuitive biological visualization
→ Easy to identify colocalization
```

## Color Palette

The false-color scheme uses standard biological visualization conventions:

| Component | RGB Value | Hex | Role |
|-----------|-----------|-----|------|
| Nucleus | [0, 255, 0] | #00FF00 | Green |
| Cytoplasm | [255, 0, 0] | #FF0000 | Red |
| Colocalization | [255, 255, 0] | #FFFF00 | Yellow (R+G) |
| Background | [0, 0, 0] | #000000 | Black |

## Future Extensions

The utility functions support adding more channels:

```typescript
export interface ChannelMixConfig {
  nucleusChannelIndex?: number | null
  cytoplasmChannelIndex?: number | null
  // Future: membraneChannelIndex, dnaChannelIndex, etc.
}

// Extended mixer:
export function mixMultipleChannelsToRGB(
  channels: Record<'nucleus' | 'cytoplasm' | 'membrane' | 'dna', 
    Uint8Array | Uint16Array | null>,
  scale: number
): Uint8Array {
  // Could combine more than 2 channels using RGB + additional compositing
}
```

## Files Modified

1. **`src/lib/utils/channelMixer.ts`** (NEW)
   - Channel mixing utility functions
   - False-color detection logic
   - Data normalization

2. **`src/lib/hooks/useVivViewer.ts`**
   - Import channelMixer utilities
   - Updated color generation logic
   - Added false-color metadata to layer props

3. **`src/types/viewer2D/vivViewer.ts`**
   - Extended `VivLayerProps` with `falseColorMode` metadata

## Integration Points

### Components that can use this:
1. **Overlay layers**: Can check `falseColorMode.enabled` to render colocalization overlays
2. **Info panels**: Can display "False-color mode: nucleus (green) + cytoplasm (red)"
3. **Export functions**: Can apply custom color LUTs based on rendering mode
4. **Colormaps**: Could apply scientific colormaps differently in single vs. dual mode

## Testing Checklist

- [ ] Load multi-channel Zarr data
- [ ] Select nucleus only → Green channel rendered
- [ ] Select cytoplasm only → Red channel rendered  
- [ ] Select both nucleus and cytoplasm → Yellow appears in overlapping regions
- [ ] Switch nucleus to different channel → Colors remain correct
- [ ] Verify contrast limits apply correctly to each channel
- [ ] Check 3D mesh segmentation still works with false-color metadata available
- [ ] Confirm overlay layers can access `falseColorMode` metadata

## Performance Considerations

- **No extra computation**: Colors are metadata only, actual mixing not computed yet
- **Ready for GPU acceleration**: The `mixChannelsToRGB()` function could be ported to WebGL shader
- **Minimal memory overhead**: Only boolean flags and channel indices stored
- **Viv handles rendering**: Existing Viv infrastructure renders separate layers with assigned colors
