# H&E Staining Troubleshooting Guide

## Problem Report
- **User observed**: Nucleus rendered in green, cytoplasm rendered in purple
- **Expected when H&E ON**: Nucleus blue-purple [163, 20, 204], cytoplasm pink-red [54, 25, 10]
- **Expected when H&E OFF**: Nucleus green [0, 255, 0], cytoplasm red [255, 0, 0]

## Analysis

The fact that nucleus appears **green** suggests the **H&E toggle is OFF** (showing false-color fallback). However, cytoplasm appearing **purple** doesn't match either color scheme:
- If H&E OFF (false-color): cytoplasm should be red [255, 0, 0]
- If H&E ON: cytoplasm should be pink-red [54, 25, 10]
- Purple suggests either a color code error or channel confusion

## Diagnostic Steps

### Step 1: Check H&E Toggle State
**Location**: Navigation Controls → Contrast section

1. Open the Navigation Controls panel (look for settings/controls button)
2. Navigate to the **Contrast** section
3. Look for the **"H&E Staining"** toggle
4. **Report**: Is the toggle currently ON or OFF?

```
🔍 QUESTION: Is the H&E Staining toggle checked/enabled?
```

**What this tells us**:
- If ON + nucleus green: Code logic issue
- If OFF + nucleus green: This is expected (false-color)
- If OFF + nucleus should be blue: Toggle is working correctly

### Step 2: Check Channel Selection
**Location**: Navigation Controls → Channels section

1. In the Navigation Controls panel, find the **Channels** section
2. Look for selections for **"Nucleus"** and **"Cytoplasm"**
3. **Report**: 
   - What channel index is assigned to Nucleus?
   - What channel index is assigned to Cytoplasm?
   - Are they different channels?

```
Example answer format:
- Nucleus: Channel 0
- Cytoplasm: Channel 1
```

**What this tells us**:
- If same channel selected: Only that channel displays (color logic wrong)
- If different channels but both null: No H&E rendering possible
- If swapped: Colors should swap

### Step 3: Enable Browser Console Logging
**How to access**:
1. Press **F12** to open Developer Tools
2. Click the **"Console"** tab
3. Look for messages starting with "Color generation:" or "Nucleus H&E color:", etc.

**What to report**:
1. When you toggle H&E ON/OFF, you should see console messages appear
2. **Copy the complete console output** that appears when:
   - You toggle H&E ON
   - You toggle H&E OFF
   - You change channel selections

**Example console output you should see**:
```
Color generation: {
  heStainingOn: true,
  canUseHEStaining: true,
  heStainingEnabled: true,
  channelMap: {nucleus: 0, cytoplasm: 1}
}
Nucleus H&E color: [163, 20, 204]
Cytoplasm H&E color: [54, 25, 10]
Final colors array: [[163, 20, 204], [54, 25, 10]]
```

### Step 4: Visual Color Test
1. With H&E OFF, note the colors you see:
   - Nucleus color (RGB notation if possible)
   - Cytoplasm color (RGB notation if possible)

2. With H&E ON, note the colors:
   - Nucleus color
   - Cytoplasm color

3. **Report the actual observed RGB values** using any color picker tool:
   - Right-click on the image → "Inspect Element"
   - Or use a color picker browser extension
   - Or use Python script to capture pixel colors

## Quick Verification Checklist

```
✅ Step 1: Is H&E Staining toggle ON?
   [ ] Yes → Problem in color logic (continue to Step 3)
   [ ] No → Toggle it ON and test again
   
✅ Step 2: Are channels selected (both nucleus and cytoplasm)?
   [ ] Both selected and different → Proceed to Step 3
   [ ] One or both null → Select both channels first
   [ ] Same channel for both → Select different channels
   
✅ Step 3: Check console for color values
   [ ] H&E ON: Do you see [163, 20, 204] for nucleus?
   [ ] H&E ON: Do you see [54, 25, 10] for cytoplasm?
   [ ] H&E OFF: Do you see [0, 255, 0] for nucleus?
   [ ] H&E OFF: Do you see [255, 0, 0] for cytoplasm?
   
✅ Step 4: Visual verification
   [ ] Colors match console output
   [ ] Colors don't match → GPU rendering issue
```

## Likely Scenarios & Solutions

### Scenario A: H&E Toggle is OFF
**Symptoms**: Nucleus green, cytoplasm red, H&E toggle shows OFF
**Solution**: Click the H&E Staining toggle to enable it
**Expected Result**: Nucleus becomes blue-purple, cytoplasm becomes pink-red

### Scenario B: Channel Selections Missing
**Symptoms**: Only one color appears, H&E toggle disabled
**Solution**: 
1. Open Channels section
2. Select channel for Nucleus
3. Select different channel for Cytoplasm
4. Now H&E toggle should become enabled
**Expected Result**: Both nucleus and cytoplasm colors appear

### Scenario C: H&E ON but Colors Wrong
**Symptoms**: H&E toggle is ON, console shows correct colors, but visual is wrong
**Possible Causes**:
1. **Viv viewer not receiving colors array** - Check if renderingMode is correct
2. **GPU color conversion issue** - Viv may apply different color space
3. **Channel data type mismatch** - Different data types render differently
**Debug Steps**:
1. Check "Final colors array" in console
2. Compare with actual rendered colors
3. May need to adjust color space conversion

### Scenario D: Cytoplasm Color is Purple (Not Red or Pink)
**Symptoms**: Cytoplasm appears purple/blue instead of red/pink
**Possible Causes**:
1. **Channels might be swapped** - Try swapping nucleus/cytoplasm assignments
2. **Different data in channels** - Cytoplasm channel might contain different image data
3. **Color blending issue** - Viv may be blending colors unexpectedly
**Debug Steps**:
1. Swap nucleus and cytoplasm channel assignments
2. If colors swap too → assignments are backwards, swap back
3. If colors stay the same → data issue, not assignment issue

## Advanced Debugging

### Enable All Console Logging
The code now includes development console.log statements. To see maximum detail:

1. Check that `process.env.NODE_ENV === 'development'` is true
2. Open DevTools Console (F12)
3. Watch for:
   - "Color generation:" object
   - Individual color calculations
   - Final colors array

### Check Viv Viewer Internal State
1. Open DevTools Console
2. Run:
```javascript
// Find the Viv viewer canvas element
const canvas = document.querySelector('canvas');
console.log('Canvas found:', !!canvas);

// Check if Viv has rendered with multiple colors
// (This depends on Viv's internal structure)
```

### Verify Color Math
The H&E color conversion math:
```
Hematoxylin: [0.64, 0.08, 0.80] → [163, 20, 204] (multiply by 255)
Eosin:       [0.21, 0.10, 0.04] → [54, 25, 10]
```

If colors appear completely different, math might be wrong.

## Reporting Results

When you've completed the diagnostic steps, please report:

```
📋 DIAGNOSTIC REPORT:

1. H&E Toggle Status: [ON/OFF]

2. Channel Selection:
   - Nucleus: Channel [#]
   - Cytoplasm: Channel [#]

3. Console Output (when H&E toggled ON):
   [paste console messages here]

4. Visual Colors Observed:
   - H&E ON - Nucleus: [R, G, B] (should be ~[163, 20, 204])
   - H&E ON - Cytoplasm: [R, G, B] (should be ~[54, 25, 10])
   - H&E OFF - Nucleus: [R, G, B] (should be [0, 255, 0])
   - H&E OFF - Cytoplasm: [R, G, B] (should be [255, 0, 0])

5. Observations:
   [any other relevant observations]
```

## Known Issues & Workarounds

### Issue: Toggle doesn't appear
**Workaround**: Make sure both nucleus and cytoplasm channels are selected first

### Issue: Colors don't update immediately
**Workaround**: Refresh the page (Ctrl+R) to force state reset

### Issue: Console doesn't show color messages
**Workaround**: Make sure dev environment is enabled, check browser console filter level

---

**Next Steps**: Complete the diagnostic steps above and share results to pinpoint the exact cause of the color rendering issue.
