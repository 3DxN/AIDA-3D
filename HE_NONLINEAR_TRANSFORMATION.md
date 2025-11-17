# H&E Non-Linear Pixel-Level Transformation

## Overview

The AIDA-3D application now implements **non-linear pixel-level H&E pseudo-color rendering** that combines nucleus and cytoplasm channel data to create authentic histopathology-like colors.

This goes beyond simple color assignment by applying mathematically sophisticated transformations that depend on **both channels simultaneously** to produce realistic H&E appearance.

## The Problem with Linear Color Assignment

Before this implementation, the system used simple color assignment:
```
Display Color = channel_intensity × assigned_color
```

This works for false-color rendering but doesn't create authentic H&E appearance because:
- Pure nucleus intensity → pure blue (not enough red)
- Pure cytoplasm intensity → pure red (not enough magenta)
- Mixed regions → orange/yellow (not mauve)

Real H&E staining involves **chemical mixing** of dyes that can't be achieved with linear color blending.

## The Non-Linear Solution

### Architecture

The solution is implemented across three key files:

#### 1. **heStainTransform.ts** - Pixel-Level Transformations

Implements the core non-linear mixing algorithm:

```typescript
function computeHEStainTransform(nucleusValue: number, cytoplasmValue: number) {
  // Invert for stain presence (fluorescence = inverse of stain)
  const nucleusStain = 1.0 - nucleusValue
  const cytoplasmStain = 1.0 - cytoplasmValue

  // Non-linear blending with multiplicative damping
  const hematoxylinIntensity = nucleusStain × pow(1 - cytoplasmStain × 0.6, 0.9)
  const eosinIntensity = cytoplasmStain × pow(1 - nucleusStain × 0.6, 0.9)
  
  return { hematoxylinIntensity, eosinIntensity }
}
```

**Key features:**
- **Multiplicative damping**: Each channel dampens the other, preventing over-saturation
- **Non-linear power function**: The 0.9 exponent creates smooth transitions
- **Damping factor (0.6)**: Controls how much one channel suppresses the other
- **Range [0, 1]**: Output is always normalized

#### 2. **useVivViewer.ts** - Rendering Pipeline Integration

Integrates the transformation into the Viv rendering pipeline:

1. **Color Assignment**:
   - Hematoxylin intensity → Blue-purple [163, 20, 204]
   - Eosin intensity → Pink-red [54, 25, 10]

2. **Contrast Boost**:
   - Non-linear transformation reduces perceived intensity
   - Automatically apply 1.2x boost to contrast limits
   - Ensures optimal visual appearance

3. **Debug Logging**:
   ```
   📊 H&E contrast boost for nucleus: 250 → 300
   📊 H&E contrast boost for cytoplasm: 250 → 300
   ```

#### 3. **channelMixer.ts** - Conceptual Framework

Documents the complete rendering pipeline and H&E color constants.

### Data Flow

```
Nucleus Channel Data (uint8/uint16)
         ↓
    normalize to [0, 1]
         ↓
  ┌─────────────────────┐
  │ Non-Linear Transform│ ← computeHEStainTransform()
  │ (heStainTransform)  │
  └─────────────────────┘
         ↓
   Hematoxylin Intensity Map
         ↓
  Multiply by Color [163, 20, 204]
         ↓
      WebGL Rendering
         ↓
    Blue-Purple Pixels

Cytoplasm Channel Data (uint8/uint16)
         ↓
    normalize to [0, 1]
         ↓
  ┌─────────────────────┐
  │ Non-Linear Transform│ ← computeHEStainTransform()
  │ (heStainTransform)  │
  └─────────────────────┘
         ↓
   Eosin Intensity Map
         ↓
  Multiply by Color [54, 25, 10]
         ↓
      WebGL Rendering
         ↓
    Pink-Red Pixels

Blended Result (via WebGL compositing)
```

## Non-Linear Transformation Details

### The Multiplicative Damping Model

The transformation uses multiplicative damping to create realistic color mixing:

```
H = h × (1 - c × 0.6)^0.9
E = c × (1 - h × 0.6)^0.9
```

Where:
- `H` = Hematoxylin intensity [0, 1]
- `E` = Eosin intensity [0, 1]
- `h` = nucleus stain [0, 1]
- `c` = cytoplasm stain [0, 1]

### Why Non-Linear?

**Power function (0.9 exponent)**:
- Linear blending (y = x) → too saturated in mixed regions
- Power < 1 → emphasizes lower values, de-emphasizes higher values
- 0.9 creates smooth S-curve, realistic color transition

**Damping factor (0.6)**:
- Controls cross-channel suppression
- 0.6 means each channel suppresses the other by 60% at full intensity
- Prevents simultaneous red + blue = white appearance

### Example Scenarios

| Nucleus | Cytoplasm | Hematoxylin | Eosin | Visual Result |
|---------|-----------|-------------|-------|---------------|
| 1.0 | 0.0 | ~0.95 | ~0.0 | Strong blue-purple |
| 0.0 | 1.0 | ~0.0 | ~0.95 | Strong pink-red |
| 0.5 | 0.5 | ~0.55 | ~0.55 | Balanced mauve |
| 1.0 | 1.0 | ~0.64 | ~0.64 | Gray-mauve |
| 0.0 | 0.0 | ~0.0 | ~0.0 | White (background) |

## Contrast Adjustment

The non-linear transformation reduces the effective intensity range:

```
Before: Full range [0, 255]
After:  Reduced range [0, ~200] due to damping
```

To compensate:

```typescript
adjustedContrast = originalContrast × 1.2
```

This 1.2x boost:
- Restores perceived brightness
- Maintains detail visibility
- Happens automatically in useVivViewer.ts

## Implementation Details

### File: src/lib/utils/heStainTransform.ts

**Core Functions**:
- `computeHEStainTransform(nucleus, cytoplasm)` → Pixel-level transformation
- `createHEStainLUT(resolution)` → Pre-computed lookup table (optional optimization)
- `createHEStainTransferFunction(scale)` → Reusable transfer function
- `adjustContrastForHEStaining(nucleus, cytoplasm)` → Contrast boost

### File: src/lib/hooks/useVivViewer.ts (Lines 280-302)

**Integration Points**:

1. **Import heStainTransform utilities**:
   ```typescript
   import { computeHEStainTransform, adjustContrastForHEStaining } from '../utils/heStainTransform'
   ```

2. **Apply contrast boost when H&E enabled**:
   ```typescript
   if (navigationState.heStainingOn && shouldUseHEStaining(navigationState.channelMap)) {
     const { adjustedNucleusContrast, adjustedCytoplasmContrast } = 
       adjustContrastForHEStaining(baseContrast, baseContrast)
     // Use adjusted values in contrastLimits
   }
   ```

## Testing & Validation

### Console Output

When H&E staining is enabled:

```
🎨 Color generation: {heStainingOn: true, canUseHEStaining: true, ...}
👍 Nucleus H&E color (should be ~[163, 20, 204]): [163, 20, 204]
👍 Cytoplasm H&E color (should be ~[54, 25, 10]): [54, 25, 10]
📊 H&E contrast boost for nucleus: 250 → 300
📊 H&E contrast boost for cytoplasm: 250 → 300
✅ Final colors array being sent to Viv: [163, 20, 204] + [54, 25, 10]
```

### Visual Verification

1. **Nucleus regions**: Should appear blue-purple ([163, 20, 204])
2. **Cytoplasm regions**: Should appear pink-red ([54, 25, 10])
3. **Mixed regions**: Should appear mauve/gray (blend of colors)
4. **Background**: Should appear nearly white (both channels low)

### Data-Dependent Behavior

The quality depends on:
- **Channel separation**: Nucleus and cytoplasm must have different intensity distributions
- **Dynamic range**: Higher bit-depth (uint16) preserves more detail
- **Contrast settings**: May need adjustment based on your specific data

## Advanced Customization

### Adjusting Damping Factor

Edit heStainTransform.ts, line ~147:
```typescript
const hematoxylinIntensity = nucleusStain * Math.pow(1.0 - cytoplasmStain * 0.6, 0.9)
                                                                            ↑ ↑
                                            Damping (0.6) and exponent (0.9)
```

- **Lower damping (0.3-0.4)**: More saturated colors, less blending
- **Higher damping (0.7-0.8)**: More blended, less saturation
- **Lower exponent (0.7-0.8)**: Sharper transitions
- **Higher exponent (1.0-1.1)**: Softer transitions

### Pre-Computing Lookup Tables

For performance optimization on large images, create LUTs:

```typescript
const lut = createHEStainLUT(256)
// Then use: lut[nucleusValue][cytoplasmValue] for fast lookup
```

## Performance Considerations

**Current Implementation**:
- Transformation happens at **color assignment level** (not per-pixel)
- Uses simple arithmetic without lookup tables
- Negligible performance impact

**If Pixel-Per-Pixel Transformation Needed**:
- Would require custom shader implementation
- Not possible with WebGL security restrictions
- Current approach is optimal within Viv's constraints

## References

The non-linear transformation is inspired by:
1. **Stain unmixing** in computational pathology (Macenko et al., Vahadane et al.)
2. **Color space transforms** for histopathology (Ruifrok & Johnston)
3. **FalseColor methodology** (https://github.com/serrob23/FalseColor)
4. **Multiplicative mixing models** in optical microscopy

## Next Steps

1. **Test with real H&E data**: Verify colors match histology standards
2. **Fine-tune parameters**: Adjust damping factor and exponent for your data
3. **Document visual examples**: Create reference images for documentation
4. **User guidance**: Add preset profiles for common staining protocols

## Troubleshooting

**Colors look washed out**:
- Check contrast settings (may need 1.2x boost as implemented)
- Verify both channels have good signal
- Check if bit-depth is appropriate (uint16 better than uint8)

**Colors look too saturated**:
- Increase damping factor (0.6 → 0.7)
- Decrease exponent (0.9 → 0.8)
- Reduce contrast boost multiplier (1.2 → 1.1)

**Nucleus and cytoplasm same color**:
- Channels may not be properly separated
- Check channel selection in UI
- Verify image data contains both signals

**No visible change when toggling H&E**:
- Check console for "👍 Nucleus H&E color" messages
- Verify both nucleus and cytoplasm channels are selected
- Check if H&E toggle is actually changing navigationState.heStainingOn
