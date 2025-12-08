# H&E Implementation: Testing & Usage Guide

## Quick Start

### 1. Load Your Data
- Open AIDA-3D
- Load a Zarr dataset with nucleus and cytoplasm channels
- Select both channels in the channel map

### 2. Enable H&E Rendering
- Look for **H&E Staining** toggle in the Navigation Controls
- Toggle **ON** to enable pseudo-coloring

### 3. Verify in Console
Open browser Developer Tools (F12) and check Console tab for:

```
✅ Expected Output:
─────────────────────
🎨 Color generation: {heStainingOn: true, canUseHEStaining: true, ...}
👍 Nucleus H&E color (should be ~[163, 20, 204]): [163, 20, 204]
👍 Cytoplasm H&E color (should be ~[54, 25, 10]): [54, 25, 10]
📊 H&E contrast boost for nucleus: 250 → 300
📊 H&E contrast boost for cytoplasm: 250 → 300
✅ Final colors array being sent to Viv: [163, 20, 204] + [54, 25, 10]
```

### 4. Observe Visual Changes
Toggle H&E ON/OFF and observe:

| Setting | Nucleus Color | Cytoplasm Color | Combined |
|---------|---------------|-----------------|----------|
| H&E OFF | Green | Red | Yellow |
| H&E ON | Blue-Purple | Pink-Red | Mauve |

## Testing Checklist

### ✅ Functional Testing

**Test 1: Toggle Works**
```
1. Load data
2. Toggle H&E OFF → observe green/red false colors
3. Toggle H&E ON → observe blue-purple/pink-red H&E colors
4. Toggle OFF again → verify colors revert
Result: ✓ Colors change correctly
```

**Test 2: Both Channels Required**
```
1. Load data
2. Select ONLY nucleus channel
3. Toggle H&E ON
4. Check console: should say "Using FALLBACK nucleus color"
5. Select ONLY cytoplasm channel
6. Toggle H&E ON
7. Check console: should say "Using FALLBACK cytoplasm color"
8. Select BOTH channels
9. Toggle H&E ON
10. Check console: should show H&E colors
Result: ✓ H&E only activates with both channels
```

**Test 3: Contrast Auto-Boost**
```
1. Load data
2. Note original contrast limit (e.g., 250)
3. Toggle H&E ON
4. Check console for: "H&E contrast boost for nucleus: 250 → 300"
5. Check console for: "H&E contrast boost for cytoplasm: 250 → 300"
Result: ✓ Contrast automatically boosted by 1.2x
```

### ✅ Visual Testing

**Test 1: Color Accuracy**
```
Load H&E reference data (if available):
- Nucleus regions should appear: BLUE-PURPLE [163, 20, 204]
- Cytoplasm regions should appear: PINK-RED [54, 25, 10]
- Mixed regions should appear: MAUVE (blend)
- Background should appear: WHITE/LIGHT
Result: ✓ Colors match expected H&E appearance
```

**Test 2: Detail Preservation**
```
1. Toggle H&E ON
2. Compare with H&E OFF
3. Check that nuclear detail is preserved
4. Check that cytoplasm boundaries are clear
5. Zoom in/out to verify at different scales
Result: ✓ Detail preserved, no degradation
```

**Test 3: Brightness/Contrast**
```
1. Toggle H&E ON
2. Check if image brightness is appropriate
3. Verify no clipping (blown-out whites or crushed blacks)
4. If too dark: increase original contrast limit
5. If too bright: decrease original contrast limit
Result: ✓ Brightness optimized for viewing
```

## Troubleshooting

### Problem: H&E colors don't appear

**Check 1: Are both channels selected?**
```javascript
// In console:
navigationState.channelMap
// Should show: { nucleus: 0, cytoplasm: 1 } (or similar non-null values)
```

**Check 2: Is H&E toggle actually ON?**
```javascript
// In console:
navigationState.heStainingOn
// Should be: true
```

**Check 3: Check console messages**
```
// Look for:
👍 Nucleus H&E color: [163, 20, 204]
// Not:
❌ Using FALLBACK nucleus color
```

### Problem: Colors look washed out

**Solution 1: Increase contrast**
- Original contrast + 1.2x boost might not be enough for your data
- Manually increase contrast limit in UI
- Try: 1.5x boost instead of 1.2x

**Solution 2: Check channel signals**
```javascript
// In console - check if channels have good signal:
navigationState.contrastLimits
// Both should be non-zero and > 100
```

**Solution 3: Check data type**
- uint16 data: better dynamic range than uint8
- Verify in zarr metadata that data is appropriate type

### Problem: No visual change when toggling H&E

**Check 1: Verify toggle is connected**
```javascript
// In console, toggle H&E:
navigationState.heStainingOn  // Should change between true/false
```

**Check 2: Verify color assignment is happening**
```
// In console, should see:
✅ Final colors array being sent to Viv: [163, 20, 204] + [54, 25, 10]
```

**Check 3: Check browser console for errors**
- Look for red error messages
- Check for warnings about WebGL/canvas

## Advanced Testing

### Programmatic Testing
```javascript
// Test the transformation functions:

import { computeHEStainTransform, adjustContrastForHEStaining } 
  from '@/lib/utils/heStainTransform'

// Test transformation
const result = computeHEStainTransform(0.8, 0.2)
console.log(result)
// Expected: { hematoxylinIntensity: ~0.8, eosinIntensity: ~0.1 }

// Test contrast boost
const contrast = adjustContrastForHEStaining(250, 250)
console.log(contrast)
// Expected: { adjustedNucleusContrast: 300, adjustedCytoplasmContrast: 300 }
```

### Performance Testing
```javascript
// Measure rendering performance with H&E ON vs OFF

// With H&E OFF:
console.time('render-off')
// ... measure frame render time
console.timeEnd('render-off')

// With H&E ON:
console.time('render-on')
// ... measure frame render time
console.timeEnd('render-on')

// Result: Should be negligible difference
```

## Data Requirements

**For optimal H&E rendering:**

1. **Channel separation**: Nucleus and cytoplasm signals should be distinct
   - Nucleus channel: HIGH in nuclei, LOW elsewhere
   - Cytoplasm channel: HIGH in cytoplasm, LOW elsewhere

2. **Data type**: uint16 preferred (uint8 works but less dynamic range)

3. **Signal-to-noise ratio**: Both channels should have clear signal above noise

4. **Contrast range**: Both channels should use most of the available bit depth
   - Don't have dead space at top/bottom of range

## Example: Perfect Test Data

```
Image 1: Pure nuclei (nucleus=255, cytoplasm=0)
Expected: Blue-purple nuclei on white background

Image 2: Pure cytoplasm (nucleus=0, cytoplasm=255)
Expected: Pink-red cytoplasm on white background

Image 3: Mixed tissue (nucleus=200, cytoplasm=150)
Expected: Mauve/gray mixed coloring

Image 4: Tissue with variation
Expected: Gradient of colors from blue-purple through mauve to pink-red
```

## Documentation

For detailed information:
- **Quick reference:** HE_VISUAL_SUMMARY.md
- **Technical details:** HE_NONLINEAR_TRANSFORMATION.md
- **Implementation:** HE_NONLINEAR_IMPLEMENTATION_SUMMARY.md
- **Current state:** HE_CURRENT_STATE.md
- **Math:** HE_MATHEMATICAL_ANALYSIS.md

## Getting Help

If something isn't working:

1. **Check console messages** - Look for debug output
2. **Verify channel selection** - Both channels required
3. **Check contrast settings** - May need adjustment
4. **Verify data format** - uint16 preferred
5. **Read documentation** - See files listed above
6. **Review test cases** - See above for expected behavior

## Success Criteria

H&E implementation is working correctly when:

✅ H&E toggle in UI changes behavior
✅ Console shows correct color values
✅ Nucleus regions appear blue-purple
✅ Cytoplasm regions appear pink-red
✅ Mixed regions appear mauve/gray
✅ Automatic contrast adjustment applies
✅ No visual artifacts or clipping
✅ Performance is unaffected

**If all checks pass: H&E rendering is working correctly!**
