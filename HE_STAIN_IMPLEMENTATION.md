# H&E Pseudo-Color Stain Implementation

## Overview

This document describes the H&E (Hematoxylin & Eosin) pseudo-coloring implementation in AIDA-3D, which translates two-channel fluorescence microscopy data (nucleus + cytoplasm) into traditional histopathology stain colors.

## H&E Staining Background

H&E staining is the gold standard in histopathology:
- **Hematoxylin**: Stains cell nuclei and chromatin in blue-purple
- **Eosin**: Stains cytoplasm and extracellular proteins in pink-red
- **Result**: Creates high contrast, easily recognizable tissue morphology

## Algorithm Overview

The implementation uses an **inverted intensity stain unmixing** approach:

```
In fluorescence microscopy:
  High fluorescence = low stain presence
  Low fluorescence = high stain presence

Therefore:
  nucleusNorm = 1.0 - (fluorescenceIntensity / maxValue)
  cytoplasmNorm = 1.0 - (fluorescenceIntensity / maxValue)
```

### Color Blending

The algorithm blends between background (white) and stain colors based on intensity:

```
FOR each pixel:
  Start with white background
  Apply hematoxylin (blue-purple) based on nucleus intensity
  Apply eosin (pink-red) based on cytoplasm intensity
  Result: natural H&E appearance
```

## Implementation Details

### Stain Color Values

AIDA-3D uses standardized H&E color space values (0-1 RGB):

```typescript
HE_STAIN_COLORS = {
  hematoxylin: [0.64, 0.08, 0.80],  // Blue-purple for nuclei
  eosin: [0.21, 0.10, 0.04],        // Pink-red for cytoplasm  
  background: [1.0, 1.0, 1.0]       // White background
}
```

### Color Rendering Examples

| Nucleus | Cytoplasm | Result Color | Appearance |
|---------|-----------|--------------|------------|
| High    | Low       | Blue-Purple  | Dark nucleus |
| Low     | High      | Pink-Red     | Eosin-stained cytoplasm |
| High    | High      | Mauve-Gray   | Mixed staining |
| Low     | Low       | White        | Unstained background |

## Usage

### Direct Function Usage

For mixing two pre-loaded channel arrays:

```typescript
import { mixChannelsToHEStain } from '@/lib/utils/channelMixer'

const rgbData = mixChannelsToHEStain(
  nucleusChannelData,      // Uint8Array or Uint16Array
  cytoplasmChannelData,    // Uint8Array or Uint16Array
  255,                     // Scale for uint8 data
  255                      // Scale for uint8 data
)
// Returns: Uint8Array with interleaved RGB [R,G,B,R,G,B,...]
```

### Factory Function Usage

For creating a reusable mixer object:

```typescript
import { createHEStainMixer } from '@/lib/utils/channelMixer'

const channelMap = { nucleus: 0, cytoplasm: 1 }
const mixer = createHEStainMixer(channelMap, 'uint16')

if (mixer.hasNucleus && mixer.hasCytoplasm) {
  const rgbData = mixer.mix({
    0: nucleusData,
    1: cytoplasmData
  })
}
```

### Detection

Check if H&E staining should be applied:

```typescript
import { shouldUseHEStaining, getRenderingMode } from '@/lib/utils/channelMixer'

if (shouldUseHEStaining(channelMap)) {
  console.log('Both nucleus and cytoplasm channels present')
  console.log('Rendering mode:', getRenderingMode(channelMap)) // 'dual'
}
```

## Integration with useVivViewer

The H&E staining system integrates with the Viv viewer through:

1. **Channel Selection**: User selects nucleus and cytoplasm channels
2. **Color Generation**: useVivViewer detects dual-channel mode and generates H&E colors
3. **Layer Props**: falseColorMode metadata indicates H&E rendering is active
4. **Rendering**: Viv applies computed colors to selections

```typescript
// In useVivViewer.ts - pseudo code
const colors = useMemo(() => {
  if (shouldUseHEStaining(navigationState.channelMap)) {
    // Return H&E-mapped colors for each selected channel
    return generateHEColors(navigationState, msInfo)
  }
  return defaultColors
}, [navigationState.channelMap, msInfo])
```

## Scientific References

### Primary References

1. **Giacomelli et al.** - Virtual H&E coloring of medical images  
   PLoS ONE, 2016
   https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0159337

2. **Serafin et al.** - FalseColor module methodology
   PLoS ONE
   https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0233198

### Related Work

- FalseColor-Python: https://github.com/serrob23/FalseColor
- Ünür et al. - Color normalization in digital pathology

## Implementation Notes

### Data Type Support

The implementation supports both uint8 and uint16 data:

```typescript
// For uint8 data (0-255)
mixChannelsToHEStain(data8, data8, 255, 255)

// For uint16 data (0-65535)  
mixChannelsToHEStain(data16, data16, 65535, 65535)
```

### Performance Characteristics

- **Single-pass algorithm**: O(n) where n = pixel count
- **Memory**: Creates new Uint8Array (3x input size for RGB)
- **No GPU acceleration**: Pure TypeScript/JavaScript (can be accelerated with WebGL if needed)

### Backward Compatibility

Legacy functions remain available:

```typescript
// Old API (simple false-color with Green/Red)
mixChannelsToRGB()          // Legacy false-color
createChannelMixer()        // Legacy factory

// New API (H&E pseudo-staining)
mixChannelsToHEStain()      // H&E stain unmixing
createHEStainMixer()        // H&E factory
shouldUseHEStaining()       // H&E detection
```

## Comparison with Other Methods

### H&E Pseudo-Coloring (Current)
- ✅ Mimics real H&E staining
- ✅ Based on peer-reviewed scientific methodology
- ✅ Efficient single-pass algorithm
- ✅ No parameters needed (uses fixed optimal colors)
- ❌ Requires exactly 2 channels (nucleus + cytoplasm)

### Simple False-Color (Legacy)
- ✅ Works with any number of channels
- ✅ Direct channel-to-color mapping
- ❌ Doesn't resemble actual staining
- ❌ Less biologically meaningful

### Multispectral Unmixing
- ✅ Handles >2 channels
- ❌ Computationally expensive
- ❌ Requires stain reference images
- ❌ Not implemented in AIDA-3D

## Future Enhancements

1. **GPU Acceleration**: WebGL shader-based H&E mixing for large datasets
2. **Stain Intensity Control**: Sliders to adjust hematoxylin/eosin saturation
3. **Alternative Staining Modes**: PAS, Trichrome, IHC color schemes
4. **Background Subtraction**: Optional white balance correction
5. **Multi-channel Support**: Extended to >2 channels with mixing matrix

## Testing

To verify H&E implementation:

```typescript
// Test 1: Pure nucleus (high intensity)
const testNuc = new Uint8Array([255])
const testCyt = new Uint8Array([0])
const result = mixChannelsToHEStain(testNuc, testCyt, 255, 255)
// Expected: Blue-purple color [~163, 20, 204]

// Test 2: Pure cytoplasm (high intensity)
const testNuc2 = new Uint8Array([0])
const testCyt2 = new Uint8Array([255])
const result2 = mixChannelsToHEStain(testNuc2, testCyt2, 255, 255)
// Expected: Pink-red color [~254, 230, 230]

// Test 3: Mixed both (high intensities)
const testNuc3 = new Uint8Array([255])
const testCyt3 = new Uint8Array([255])
const result3 = mixChannelsToHEStain(testNuc3, testCyt3, 255, 255)
// Expected: Mauve/gray-purple
```

## Configuration

The H&E colors are defined as constants in `channelMixer.ts`:

```typescript
export const HE_STAIN_COLORS = {
  hematoxylin: [0.64, 0.08, 0.80],  // [R, G, B] in 0-1 range
  eosin: [0.21, 0.10, 0.04],        // [R, G, B] in 0-1 range
  background: [1.0, 1.0, 1.0]       // [R, G, B] in 0-1 range
}
```

To customize colors for different staining protocols, modify these values:

```typescript
// Example: Create custom staining profile
const CUSTOM_STAIN_COLORS = {
  nuclear: [0.5, 0.2, 0.8],    // Custom nuclear color
  cytoplasmic: [0.9, 0.3, 0.2], // Custom cytoplasmic color
  background: [1.0, 1.0, 1.0]
}
```

## Troubleshooting

### Colors Look Inverted

**Cause**: Fluorescence intensities may be inverted relative to stain presence
**Solution**: The implementation assumes `1.0 - normalized_intensity` relationship. If your data is already inverted, remove the inversion:

```typescript
// In mixChannelsToHEStain, change:
const nucleusNorm = 1.0 - Math.min(nucleusData[i] / nucleusScale, 1.0)
// To:
const nucleusNorm = Math.min(nucleusData[i] / nucleusScale, 1.0)
```

### Colors Look Washed Out

**Cause**: Data range may not utilize full 0-255 uint8 range
**Solution**: Apply histogram stretching before mixing, or adjust scale factors:

```typescript
// Use actual data min/max for better contrast
mixChannelsToHEStain(data, data, actualMax, actualMax)
```

### Only One Channel Shows

**Cause**: Other channel is null or mapping is incorrect
**Solution**: Verify channelMap has both nucleus and cytoplasm indices:

```typescript
console.log('Nucleus index:', channelMap.nucleus)
console.log('Cytoplasm index:', channelMap.cytoplasm)
```

## See Also

- `src/lib/utils/channelMixer.ts` - Implementation
- `src/lib/hooks/useVivViewer.ts` - Integration point
- `FALSE_COLOR_DOCUMENTATION_INDEX.md` - Related false-color rendering docs
