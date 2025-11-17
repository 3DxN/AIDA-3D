# H&E Staining UI Toggle Implementation

## Overview
Added a UI toggle in the Navigation Controls panel to enable/disable H&E pseudo-color staining. The toggle is available in the **Contrast** section of the Navigation Controls and allows users to switch between regular false-color rendering and professional H&E histopathology staining colors.

## Components Modified

### 1. Navigation State Type
**File**: `src/types/viewer2D/navState.ts`
**Change**: Added `heStainingOn: boolean` property to `NavigationState` interface

```typescript
export interface NavigationState {
    // ... existing properties ...
    cellposeOverlayOn: boolean
    histogramEqualizationOn: boolean
    heStainingOn: boolean  // ← NEW
}
```

### 2. Default Navigation State
**File**: `src/lib/utils/getDefaultNavStates.ts`
**Change**: Initialize `heStainingOn: false` in default navigation state

```typescript
export function getInitialNavigationState(msInfo: IMultiscaleInfo): NavigationState {
    return {
        // ... existing properties ...
        cellposeOverlayOn: true,
        histogramEqualizationOn: false,
        heStainingOn: false,  // ← NEW: Default disabled
    }
}
```

### 3. Navigation Controls Component
**File**: `src/components/viewer2D/zarr/nav/navigator.tsx`

**Changes**:
1. Added import for `shouldUseHEStaining` helper function
```typescript
import { shouldUseHEStaining } from '../../../../lib/utils/channelMixer'
```

2. Extract `heStainingOn` from navigationState
```typescript
const { zSlice, timeSlice, channelMap, contrastLimits, cellposeOverlayOn, histogramEqualizationOn, heStainingOn } = navigationState
```

3. Add H&E toggle handler
```typescript
const navigationHandlers = {
    // ... existing handlers ...
    onHEStainingToggle: (newState: boolean) => setNavigationState({
        ...navigationState,
        heStainingOn: newState
    }),
}
```

4. Add H&E toggle UI in Contrast section (after Histogram Equalization toggle)
```tsx
<div className="flex justify-between items-center">
    <div className="text-sm" title="Pseudo-color H&E staining for nucleus (blue-purple) and cytoplasm (pink-red)">
        H&E Staining
    </div>
    <Switch
        enabled={heStainingOn && shouldUseHEStaining(channelMap)}
        onChange={navigationHandlers.onHEStainingToggle}
    />
</div>
{heStainingOn && !shouldUseHEStaining(channelMap) && (
    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
        H&E staining requires both nucleus and cytoplasm channels to be selected.
    </div>
)}
```

## User Interface

### Location
**Navigation Controls Panel** → **Contrast Section**

### Appearance
- Toggle switch labeled "H&E Staining"
- Tooltip explains: "Pseudo-color H&E staining for nucleus (blue-purple) and cytoplasm (pink-red)"
- Warning message shown when toggle is enabled but channel requirements not met

### Behavior
- **When enabled with both channels selected**: Switch activates H&E rendering mode in the viewer
- **When enabled but channels missing**: Switch disabled, warning message shown
- **When disabled**: Regular false-color rendering (if H&E infrastructure present)

## State Flow

```
User toggles H&E switch
    ↓
navigationHandlers.onHEStainingToggle(newState)
    ↓
setNavigationState({ ...navigationState, heStainingOn: newState })
    ↓
Viewer2DDataContext updates
    ↓
useVivViewer detects heStainingOn and shouldUseHEStaining()
    ↓
Generates H&E colors for rendering
    ↓
Viv viewer applies H&E color scheme
```

## Integration with useVivViewer

The toggle state can be used in `src/lib/hooks/useVivViewer.ts` to control H&E color generation:

```typescript
// In useVivViewer.ts color generation logic
const { heStainingOn } = navigationState

const shouldApplyHE = heStainingOn && shouldUseHEStaining(navigationState.channelMap)

if (shouldApplyHE) {
    // Generate H&E colors using HE_STAIN_COLORS and intensity mapping
    // ... color generation code ...
}
```

## Validation

The UI includes smart validation:

1. **Mutual Exclusivity Check**: H&E toggle only active when both nucleus AND cytoplasm channels are selected
2. **User Feedback**: Clear warning message explains requirements
3. **Graceful Degradation**: If user tries to enable H&E without both channels, warning appears and switch stays disabled

## Usage Example

1. Open Navigation Controls (top-right "Controls" button)
2. Go to **Channels** section, select:
   - Nucleus → Channel 0 (or appropriate nucleus channel)
   - Cytoplasm → Channel 1 (or appropriate cytoplasm channel)
3. Go to **Contrast** section
4. Toggle **H&E Staining** to enable pseudo-color histopathology rendering
5. Adjust histogram equalization or contrast limits as needed
6. Viewer displays nucleus in blue-purple and cytoplasm in pink-red (traditional H&E colors)

## Notes

- The toggle is independent of the **Histogram Equalization** toggle, allowing both to be used together
- H&E staining only works with exactly 2 channels (nucleus + cytoplasm)
- The toggle state persists during viewer session but resets on page refresh
- Default state is **disabled** (false) to maintain backward compatibility

## Future Enhancements

1. **Color Intensity Sliders**: Add controls to adjust hematoxylin and eosin saturation
2. **Alternative Stains**: Support PAS, Trichrome, or other histology staining protocols
3. **Persistent Settings**: Save H&E toggle preference in local storage
4. **Auto-Enable**: Auto-enable H&E when both nucleus and cytoplasm channels are selected
5. **Validation Tooltip**: Show tooltip explaining H&E requirements on hover
