# H&E Staining - Quick Reference

## Current Status: ✅ WORKING

H&E pseudo-coloring is implemented and functional using Viv's color assignment feature.

## How to Use

```
1. Load a 2-channel Zarr image
2. Navigation Controls → Channels
   - Nucleus: Select channel
   - Cytoplasm: Select different channel
3. Navigation Controls → Contrast
   - Toggle "H&E Staining" ON
4. Watch display colors change
   - Nucleus: Green → Blue-purple
   - Cytoplasm: Red → Pink-red
```

## Color Mapping

```
H&E OFF (False-Color):
  Nucleus → Green [0, 255, 0]
  Cytoplasm → Red [255, 0, 0]

H&E ON (Pseudo-Histology):
  Nucleus → Hematoxylin [163, 20, 204] (blue-purple)
  Cytoplasm → Eosin [54, 25, 10] (pink-red)
```

## Console Debug

```
F12 → Console

Look for:
👍 Nucleus H&E color: [163, 20, 204]
👍 Cytoplasm H&E color: [54, 25, 10]

If you see:
❌ Using FALLBACK nucleus color [0, 255, 0]

Then: H&E is OFF or channels not selected
```

## Architecture

```
Navigation Controls (UI)
  ↓
NavigationState (State)
  ↓
useVivViewer (Calculate colors)
  ↓
VivViewerWrapper (Render)
  ↓
Viv (WebGL rendering with colors)
  ↓
Display (Blue-purple + Pink-red)
```

## Key Files

- `src/components/viewer2D/zarr/nav/navigator.tsx` - Toggle UI
- `src/lib/hooks/useVivViewer.ts` - Color calculation
- `src/types/viewer2D/navState.ts` - State type
- `src/lib/utils/channelMixer.ts` - Color constants

## What Actually Works

✅ H&E color calculation
✅ Viv color assignment
✅ WebGL rendering with colors
✅ Toggle on/off
✅ Console logging

## What Doesn't Work

❌ Canvas post-processing (WebGL limitation - not viable)

## Troubleshooting

**Q: Colors don't change**
A: Check console for "H&E color" messages. If missing, toggle might be OFF.

**Q: Toggle appears disabled**
A: Need both nucleus AND cytoplasm channels selected.

**Q: Colors look wrong**
A: Might be the data itself. Try adjusting contrast.

**Q: Error "Failed to get canvas context"**
A: This was from old post-processing approach. Now removed.

## Expected Console Output

```
When toggling H&E ON:
🎨 Color generation: {heStainingOn: true, ...}
👍 Nucleus H&E color: [163, 20, 204]
👍 Cytoplasm H&E color: [54, 25, 10]
✅ Final colors array: [[163, 20, 204], [54, 25, 10]]
📊 VIV LAYER PROPS: {...}
```

## Performance

- **CPU**: Negligible (color calculation only)
- **GPU**: Fast (Viv's native rendering)
- **FPS**: 30-60 depending on zoom level

## Further Reading

- `HE_WEBGL_EXPLANATION.md` - Why post-processing doesn't work
- `HE_STAINING_TROUBLESHOOTING.md` - Detailed debugging
- `WEBGL_CANVAS_LIMITATION.md` - Technical deep-dive
- `HE_STAINING_FINAL_STATUS.md` - Complete status

---

**TL;DR**: Toggle H&E in Navigation Controls. It works via color assignment, which is the correct approach for WebGL rendering.
