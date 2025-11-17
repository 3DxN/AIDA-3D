# Diagnostic: Nucleus Green, Cytoplasm Purple

## Problem Description
- Nucleus channel rendering: **Green** [0, 255, 0]
- Cytoplasm channel rendering: **Purple/Blue** [some value]
- Expected: Nucleus should be Blue-Purple, Cytoplasm should be Pink-Red

## Analysis

### Expected H&E Colors
```
Nucleus (Hematoxylin):  [163, 20, 204]  = Blue-Purple (#A314CC)
Cytoplasm (Eosin):      [54, 25, 10]    = Pink-Red (#36190A)
```

### What You're Seeing
```
Nucleus:    Green [0, 255, 0]     (#00FF00)
Cytoplasm:  Purple/Blue ???       (Unknown - not matching either H&E or standard false-color)
```

### Possible Causes

#### Cause 1: H&E Toggle Is OFF ⚠️
**Most Likely**

When H&E is OFF, the fallback is:
```
Nucleus:    Green [0, 255, 0]
Cytoplasm:  Red [255, 0, 0]
```

But you said cytoplasm is purple/blue, not red. So this might be partially true.

**Check**: Is the H&E toggle actually checked in the Navigation Controls?

---

#### Cause 2: Channels Are Swapped 🔄
**Possible**

If the nucleus and cytoplasm channels are assigned backwards:

```
User thinks:
  Nucleus = Channel 0
  Cytoplasm = Channel 1

But actually:
  Nucleus = Channel 1 (which contains cytoplasm data)
  Cytoplasm = Channel 0 (which contains nucleus data)

Then the colors would be applied backwards!
```

**Check**: Which channels do you have selected? Try swapping them.

---

#### Cause 3: Color Values Wrong 🎨
**Less Likely**

The eosin color [0.21, 0.10, 0.04] converts to [54, 25, 10] which is brownish-red, not purple.

Purple would be something like [128, 0, 255] or [100, 50, 200].

If cytoplasm is showing purple, it might be:
- A different color being applied
- Or a mix of the colors (Viv blending channels?)

---

#### Cause 4: H&E Logic Not Triggering 🔧
**Less Likely**

The color assignment logic checks:
```typescript
if (heStainingEnabled) {
    if (role === 'nucleus') {
        return [163, 20, 204]  // Blue-purple
    }
}
```

If this isn't executing, it falls back to:
```typescript
if (canUseHEStaining) {
    if (role === 'nucleus') {
        return [0, 255, 0]  // Green ← This matches!
    }
}
```

So we ARE seeing the fallback colors. Why?

Possibilities:
- `heStainingEnabled` is false even though toggle is ON
- `canUseHEStaining` is false (missing channel?)
- Toggle logic isn't updating state

---

## Debugging Steps

### Step 1: Verify H&E Toggle State

**In Navigation Controls:**
1. Open Controls (top-right)
2. Go to **Contrast** section
3. Look at **"H&E Staining"** toggle
   - If **Checked ✓** → go to Step 2
   - If **Unchecked ☐** → Toggle it ON and colors should change
   - If **Disabled (greyed)** → go to Step 3

### Step 2: Verify Channel Selection

**In Navigation Controls:**
1. Go to **Channels** section
2. Check **Nucleus** dropdown
   - Should show: "Channel 0", "Channel 1", or similar
   - Should NOT say: "Select Channel"
3. Check **Cytoplasm** dropdown
   - Should show: different channel than nucleus
   - Should NOT say: "Select Channel"

If either is "Select Channel" → toggle H&E and it should work

### Step 3: Check Browser Console

**Open DevTools (F12):**
1. Click **Console** tab
2. Look for errors
3. In console, type:
   ```javascript
   // Check if navigationState exists
   window.navigationState
   
   // Should show something like:
   {
     heStainingOn: true,
     channelMap: { nucleus: 0, cytoplasm: 1 },
     ...
   }
   ```

### Step 4: Try Swapping Channels

This will tell us if channels are backwards:

**Original:**
- Nucleus = Channel 0
- Cytoplasm = Channel 1
- Result: Green nucleus, purple cytoplasm

**Swap to:**
- Nucleus = Channel 1
- Cytoplasm = Channel 0
- Result: ??? 

If colors swap too, channels were backwards!

---

## Most Likely Solutions

### Solution 1: Toggle H&E ON (if it's OFF)
**Probability**: 60%

1. Open Navigation Controls
2. Go to **Contrast** section
3. Click **H&E Staining** toggle to check it
4. Colors should change to blue-purple (nucleus) and pink-red (cytoplasm)

### Solution 2: Swap Nucleus and Cytoplasm Channels
**Probability**: 30%

1. Open Navigation Controls
2. Go to **Channels** section
3. Select different channels for Nucleus and Cytoplasm
4. If colors change appropriately, you found the issue!

### Solution 3: Check Channel Data
**Probability**: 10%

Your channels might not match what you think they are:
- Channel 0 might not actually be nucleus
- Channel 1 might not actually be cytoplasm
- Try different combinations

---

## Expected Behavior After Fix

### When Fixed:
```
Nucleus channel:    Blue-Purple [163, 20, 204]
Cytoplasm channel:  Pink-Red [54, 25, 10]
Appearance:         Like traditional H&E histology slide
```

### If Wrong Colors Still Show:
```
Nucleus:    Green [0, 255, 0]
Cytoplasm:  Red [255, 0, 0]
Reason:     H&E toggle is OFF (showing false-color)
Fix:        Toggle H&E ON in Contrast section
```

---

## What NOT to Do

❌ Don't assume the data is wrong
❌ Don't modify code without checking UI first
❌ Don't mix up which channel is nucleus/cytoplasm
❌ Don't forget to toggle H&E ON

---

## Quick Test

Try this exact sequence:

1. **Open Controls** (top-right button)
2. **Channels section**: Set Nucleus=0, Cytoplasm=1
3. **Contrast section**: Toggle H&E Staining ON
4. **Enable Histogram Equalization** (in Contrast section)
5. **Look at image**:
   - Nucleus regions should be **blue-purple**
   - Cytoplasm regions should be **pink-red**
   - Toggle H&E OFF → colors change to green/red (false-color)
   - Toggle H&E ON → colors change back to blue-purple/pink-red

If this works, you're good! If not, report which step failed.

---

## Color Reference

### What You Should See

**H&E Mode (ON):**
```
Nucleus:    #A314CC (Blue-Purple)    [163, 20, 204]
Cytoplasm:  #36190A (Pink-Red)       [54, 25, 10]
```

**False-Color Mode (OFF):**
```
Nucleus:    #00FF00 (Green)          [0, 255, 0]
Cytoplasm:  #FF0000 (Red)            [255, 0, 0]
```

### What You're Currently Seeing

```
Nucleus:    #00FF00 (Green)          [0, 255, 0]  ← False-color
Cytoplasm:  ??? (Purple/Blue)        [?, ?, ?]   ← Unexpected
```

The nucleus color matches **false-color mode**, so H&E is likely OFF.

But cytoplasm color is unexpected - should be red if false-color OFF, or pink-red if H&E ON.

This suggests:
1. H&E is OFF (nucleus correct)
2. But something else is happening with cytoplasm color

---

## Next Steps

**Please report:**
1. Is H&E toggle checked or unchecked?
2. Which channels are selected for Nucleus and Cytoplasm?
3. What color do you actually see for cytoplasm? (Purple, Blue, Dark Purple, etc.)
4. Are there any console errors?

With this info, I can pinpoint the exact issue!
