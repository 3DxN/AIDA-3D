# H&E Staining Integration with useVivViewer

## Overview

The H&E staining toggle has been fully integrated into the color generation logic of `useVivViewer.ts`. When users enable the H&E staining toggle in the Navigation Controls, the viewer dynamically switches from standard false-color rendering to professional H&E pseudo-color rendering.

## Integration Points

### 1. Import H&E Color Constants
**File**: `src/lib/hooks/useVivViewer.ts` (Line 15)

```typescript
import { shouldUseHEStaining, getRenderingMode, HE_STAIN_COLORS } from '../utils/channelMixer'
```

The `HE_STAIN_COLORS` constant provides standard H&E color values:
- **Hematoxylin**: `[0.64, 0.08, 0.80]` (blue-purple for nuclei)
- **Eosin**: `[0.21, 0.10, 0.04]` (pink-red for cytoplasm)

### 2. Updated Color Generation Logic
**File**: `src/lib/hooks/useVivViewer.ts` (Lines 122-185)

The `colors` useMemo hook now:

1. **Extracts state**: Gets `heStainingOn` from `navigationState`
2. **Checks capabilities**: Determines if both channels are available (`canUseHEStaining`)
3. **Validates conditions**: Computes `heStainingEnabled = heStainingOn && canUseHEStaining`
4. **Maps colors based on mode**:
   - **H&E mode enabled** → Uses `HE_STAIN_COLORS` (scientific histopathology colors)
   - **H&E mode disabled** → Falls back to default false-color (green for nucleus, red for cytoplasm)
5. **Dependency tracking**: Includes `navigationState.heStainingOn` in dependency array for reactivity

### 3. Color Conversion
Each channel role is assigned a color in 0-255 RGB range:

```typescript
// H&E Mode (Hematoxylin for nucleus)
[
    Math.round(0.64 * 255),  // R: 163
    Math.round(0.08 * 255),  // G: 20
    Math.round(0.80 * 255)   // B: 204
]
// Result: Blue-purple [163, 20, 204]

// H&E Mode (Eosin for cytoplasm)
[
    Math.round(0.21 * 255),  // R: 54
    Math.round(0.10 * 255),  // G: 25
    Math.round(0.04 * 255)   // B: 10
]
// Result: Pink-red [54, 25, 10]
```

## Rendering Pipeline

```
User toggles H&E Staining in UI
    ↓
Navigator updates navigationState.heStainingOn
    ↓
Viewer2DDataContext re-renders with new state
    ↓
useVivViewer receives updated navigationState
    ↓
colors useMemo recalculates (due to heStainingOn dependency)
    ↓
heStainingEnabled = navigationState.heStainingOn && shouldUseHEStaining(channelMap)
    ↓
For each selected channel:
  IF heStainingEnabled:
    - nucleus → Hematoxylin (blue-purple) [163, 20, 204]
    - cytoplasm → Eosin (pink-red) [54, 25, 10]
  ELSE:
    - nucleus → Green [0, 255, 0]
    - cytoplasm → Red [255, 0, 0]
    ↓
colors array passed to Viv viewer
    ↓
Viv applies colors to layer rendering
    ↓
Viewer displays image with appropriate color scheme
```

## Rendering Modes

### Mode 1: H&E Staining Enabled
**Conditions**: 
- H&E toggle is ON
- Both nucleus AND cytoplasm channels selected

**Colors**:
- Nucleus: Blue-purple [163, 20, 204] (Hematoxylin)
- Cytoplasm: Pink-red [54, 25, 10] (Eosin)
- Overlap: Purple-red (natural blending)

**Use Case**: Professional histopathology visualization, resembles actual H&E microscopy

### Mode 2: Standard False-Color (H&E Disabled)
**Conditions**:
- H&E toggle is OFF, OR
- Only one channel selected

**Colors**:
- Nucleus: Green [0, 255, 0]
- Cytoplasm: Red [255, 0, 0]
- Overlap: Yellow [255, 255, 0]

**Use Case**: Quick multi-channel visualization, high contrast debugging

### Mode 3: Single Channel (No H&E Option)
**Conditions**: Only nucleus OR only cytoplasm selected

**Colors**: 
- Selected channel uses appropriate default color

**Use Case**: Single-channel inspection

## Code Flow Example

### Scenario: User enables H&E staining

```typescript
// 1. User clicks H&E toggle in Navigation Controls
navigationHandlers.onHEStainingToggle(true)

// 2. Handler updates context state
setNavigationState({
    ...navigationState,
    heStainingOn: true  // ← Changed
})

// 3. Viewer2DDataContext propagates state change
// useVivViewer receives updated navigationState prop

// 4. colors useMemo re-evaluates (heStainingOn changed)
const canUseHEStaining = shouldUseHEStaining(channelMap)  // true
const heStainingEnabled = navigationState.heStainingOn && canUseHEStaining  // true

// 5. For nucleus channel:
if (heStainingEnabled) {
    if (role === 'nucleus') {
        return [163, 20, 204]  // Hematoxylin blue-purple
    }
}

// 6. For cytoplasm channel:
if (heStainingEnabled) {
    if (role === 'cytoplasm') {
        return [54, 25, 10]  // Eosin pink-red
    }
}

// 7. colors = [[163, 20, 204], [54, 25, 10]]
// 8. Viv viewer applies colors to nucleus and cytoplasm layers
// 9. Viewer re-renders with H&E color scheme
```

## Dependency Management

The `colors` useMemo includes both:
- `navigationState.channelMap` (channel role selections)
- `navigationState.heStainingOn` (H&E toggle state)

This ensures the colors recalculate whenever:
1. User changes channel selections
2. User toggles H&E staining
3. Toggle state changes based on channel availability

## Backward Compatibility

The integration maintains full backward compatibility:

1. **Graceful Fallback**: If `heStainingOn` is undefined, defaults to false
2. **Channel Validation**: Only uses H&E colors if both channels are available
3. **Standard Defaults**: Falls back to green/red false-color when H&E disabled
4. **No Breaking Changes**: Existing color logic unchanged for non-H&E mode

## Performance Characteristics

- **useMemo Optimization**: Colors only recalculated when dependencies change
- **No Extra Computations**: Simple conditional logic, no pixel-level processing
- **Immediate Response**: Toggle changes reflect instantly in viewer
- **Memory Efficient**: Colors array is small (2 RGB triplets = 24 bytes)

## Testing Checklist

- [ ] Toggle H&E staining with both nucleus and cytoplasm channels
  - Expected: Colors switch to blue-purple (nucleus) and pink-red (cytoplasm)
- [ ] Toggle H&E staining with only nucleus channel
  - Expected: Warning shown, toggle disabled, colors unchanged
- [ ] Toggle H&E staining on/off repeatedly
  - Expected: Colors update smoothly without lag
- [ ] Change channel selections while H&E enabled
  - Expected: Colors update immediately
- [ ] Refresh page with H&E toggle on
  - Expected: H&E disabled by default (heStainingOn: false)
- [ ] Switch between H&E and false-color modes
  - Expected: Smooth color transition

## Future Enhancements

1. **Color Intensity Control**: Add sliders to adjust hematoxylin/eosin saturation
2. **Alternative Stains**: Support PAS, Trichrome, or other protocols
3. **GPU Acceleration**: Optional WebGL-based color mixing for large images
4. **Persistence**: Save H&E preference in localStorage
5. **Background Subtraction**: Implement white balance correction for H&E
6. **Multi-Channel Mixing**: Extend beyond 2 channels with custom mixing matrix

## Related Files

- `src/lib/utils/channelMixer.ts` - H&E color definitions and utilities
- `src/components/viewer2D/zarr/nav/navigator.tsx` - UI toggle component
- `src/types/viewer2D/navState.ts` - NavigationState type definition
- `src/lib/utils/getDefaultNavStates.ts` - Default state initialization
- `HE_STAIN_IMPLEMENTATION.md` - Algorithm documentation
- `HE_STAINING_UI_TOGGLE.md` - UI implementation guide
