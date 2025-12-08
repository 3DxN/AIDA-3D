# Channel Selection Bug Fix

## Problem
The semantic channel selection (nucleus/cytoplasm) was not actually filtering which channels get rendered. Instead, all channels were being rendered simultaneously with different colors applied to them.

### Root Cause
In `src/lib/hooks/useVivViewer.ts`, the `selections` object was missing the critical **channel index (`c`)** dimension. It only included Z and T slices, which meant Viv was loading and rendering **all channels** regardless of what was selected in the channel map.

**Before (buggy code):**
```typescript
const selections = useMemo(() => {
    // ...
    const selection: Record<string, number> = {}
    if (shape.z && shape.z >= 0) {
        selection.z = navigationState.zSlice
    }
    if (shape.t && shape.t >= 0) {
        selection.t = navigationState.timeSlice
    }
    return [selection]  // ❌ No channel selection!
}, [navigationState, msInfo.shape])
```

## Solution
Three key changes were made to properly implement channel selection:

### 1. Fixed `selections` to include channel indices

**After (fixed code):**
```typescript
const selections = useMemo(() => {
    // ... validation ...
    const roleSelections = Object.entries(channelMap)
        .filter(entry => entry[1] !== null)
        .map(([role, channelIndex]) => {
            const selection: Record<string, number> = {
                c: channelIndex as number  // ✅ Added channel selection
            }
            if (shape.z && shape.z >= 0) {
                selection.z = navigationState.zSlice
            }
            if (shape.t && shape.t >= 0) {
                selection.t = navigationState.timeSlice
            }
            return selection
        })
    return roleSelections.length > 0 ? roleSelections : []
}, [navigationState, msInfo.shape])
```

**Key improvement**: Now creates one selection per mapped channel (nucleus, cytoplasm, etc.), with the specific channel index included. This tells Viv to render only those specific channels.

### 2. Updated `colors` to match selected channels

Since selections now creates one layer per selected channel, colors must also have one entry per selected channel:

```typescript
const colors = useMemo(() => {
    const defaultColors = [
        [0, 255, 0],    // Nucleus (green)
        [255, 0, 0],    // Cytoplasm (red)
    ]
    
    const roleColors = Object.entries(channelMap)
        .filter(entry => entry[1] !== null)
        .map(([role, channelIndex], roleIndex) => {
            return defaultColors[roleIndex % defaultColors.length]
        })
    
    return roleColors.length > 0 ? roleColors : [defaultColors[0]]
}, [navigationState.channelMap])
```

**Key improvement**: Colors array now has exactly one entry per selected channel, matching the selections array length.

### 3. Updated `contrastLimits` and `channelsVisible` to match

```typescript
const contrastLimits = Object.entries(navigationState.channelMap)
    .filter(entry => entry[1] !== null)
    .map(([role, channelIndex], roleIndex) => {
        return [0, navigationState.contrastLimits[roleIndex]] as [number, number]
    })

const channelsVisible = Array.from(
    { length: Object.values(navigationState.channelMap).filter(c => c !== null).length },
    () => true
)
```

**Key improvement**: Both arrays now match the number of selected channels instead of all available channels.

## Impact

### Before Fix
- All channels rendered simultaneously
- UI shows different colors, masking the bug
- Channel selection dropdown had no effect on rendered data
- Inefficient: loading channels that aren't selected

### After Fix
- Only selected channels are loaded and rendered
- Channel selection now properly filters which data is displayed
- nucleus/cytoplasm roles now control which physical channels are shown
- More efficient: only loading what's needed

## Testing Checklist

- [ ] Load a multi-channel Zarr array
- [ ] Toggle nucleus channel on/off → should appear/disappear
- [ ] Toggle cytoplasm channel on/off → should appear/disappear
- [ ] Switch nucleus to different channel → should display that channel with nucleus color
- [ ] Verify contrast limits apply correctly to selected channels
- [ ] Verify colors are correct (green for nucleus, red for cytoplasm)
- [ ] Check 3D viewer still correctly loads mesh segmentation

## Files Modified
- `src/lib/hooks/useVivViewer.ts` (lines 91-234)
