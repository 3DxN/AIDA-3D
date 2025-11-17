# Debugging H&E Post-Processing Implementation

## Quick Verification

To verify the H&E post-processing is working, run this in the browser console:

```javascript
// Check if canvas exists
const canvas = document.querySelector('.viv-viewer-container canvas')
console.log('Canvas found:', !!canvas)
console.log('Canvas size:', canvas?.width, 'x', canvas?.height)

// Check if H&E is enabled
const navigationState = window.__VIEWER_STATE__ // if you expose it
console.log('H&E enabled:', navigationState?.heStainingOn)

// Manually test canvas post-processing
if (canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const imageData = ctx.getImageData(0, 0, 100, 100)
  const pixels = imageData.data
  
  // Log first few pixels
  for (let i = 0; i < 5; i++) {
    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]
    console.log(`Pixel ${i}: R=${r}, G=${g}, B=${b}`)
  }
}
```

## Console Messages

When H&E post-processing is active, you should see in the console:

### On Toggle (From `useVivViewer.ts`)
```
🎨 Color generation: {
  heStainingOn: true,
  canUseHEStaining: true,
  heStainingEnabled: true,
  channelMap: {nucleus: 0, cytoplasm: 1}
  willUseHEMixing: "YES"
}
👍 Nucleus H&E color (should be ~[163, 20, 204]): [163, 20, 204]
👍 Cytoplasm H&E color (should be ~[54, 25, 10]): [54, 25, 10]
✅ Final colors array being sent to Viv: [163, 20, 204] + [54, 25, 10]
```

### On Each Frame (From `canvasHEStainProcessor.ts`)
```
✅ H&E staining applied to canvas
```

### If Something Goes Wrong
```
⚠️ Canvas has zero dimensions, skipping H&E processing
❌ Failed to get canvas context for H&E processing
❌ Error applying H&E staining to canvas: [error details]
```

## Debugging Steps

### Step 1: Verify Canvas is Found

In VivViewerWrapper.tsx, the code finds the canvas like this:
```typescript
const canvas = containerRef.current?.querySelector('canvas')
```

**Debug it**:
```javascript
const container = document.querySelector('.viv-viewer-container')
console.log('Container:', container)

const canvas = container?.querySelector('canvas')
console.log('Canvas found:', !!canvas, canvas)
```

### Step 2: Verify H&E State is True

**Check**: Is `navigationState.heStainingOn` actually true when you toggle?

In the component:
```typescript
console.log('H&E Staining enabled:', navigationState.heStainingOn)
```

In the console manually:
```javascript
// Monitor the state changes
// (requires exposing navigationState, or checking React DevTools)
```

### Step 3: Verify Post-Processing Hook is Running

The useEffect in VivViewerWrapper should run when heStainingOn changes.

**Expected**:
1. Click H&E toggle → should see console message
2. useEffect runs → setupCanvasHEProcessing() is called
3. requestAnimationFrame starts → "✅ H&E staining applied to canvas" appears every frame

**If it doesn't appear**:
- Check if heStainingOn is actually true
- Check if canvas is found
- Check if there are JavaScript errors in console

### Step 4: Verify Pixel Data is Being Read

Add this to `canvasHEStainProcessor.ts` in the `applyHEStainToCanvas()` function:

```typescript
// After getImageData
const imageData = ctx.getImageData(0, 0, width, height)
const pixelData = imageData.data

// Log first few pixels to see what Viv is rendering
console.log('Raw RGBA pixels from Viv:')
for (let i = 0; i < Math.min(5, pixelData.length / 4); i++) {
  console.log(`Pixel ${i}: R=${pixelData[i*4]}, G=${pixelData[i*4+1]}, B=${pixelData[i*4+2]}, A=${pixelData[i*4+3]}`)
}
```

This shows if Viv is rendering green for nucleus and red for cytoplasm.

### Step 5: Verify Channel Extraction

In `extractChannelsFromRGBA()`, add logging:

```typescript
// After extracting channels
console.log('Extracted nucleus data (first 10):', nucleusData?.slice(0, 10))
console.log('Extracted cytoplasm data (first 10):', cytoplasmData?.slice(0, 10))
```

This shows if channels are being properly extracted from the RGB pixels.

### Step 6: Verify H&E Mixing

In `applyHEStainToCanvas()`, log the result:

```typescript
// After mixing
const mixedRGB = mixChannelsToHEStain(nucleusData, cytoplasmData, scale, scale)

console.log('Mixed H&E RGB (first 30 values):', mixedRGB.slice(0, 30))
// Should show values like [163, 20, 204, 54, 25, 10, ...] (H&E colors)
```

This shows if mixing is producing the correct H&E colors.

## Expected Pixel Values

### From Viv (Before Post-Processing)
When H&E is OFF (false-color):
```
Nucleus channel: [0, 255, 0, 255] (green)
Cytoplasm channel: [255, 0, 0, 255] (red)
Overlap: [255, 255, 0, 255] (yellow)
```

### After H&E Post-Processing
When H&E is ON:
```
High nucleus: [163, 20, 204, 255] (Hematoxylin blue-purple)
High cytoplasm: [54, 25, 10, 255] (Eosin pink-red)
Both high: [something mauve]
Both low: [255, 255, 255, 255] (white background)
```

## Performance Monitoring

To check if post-processing is causing lag:

```javascript
// In browser console, override applyHEStainToCanvas to measure time
const original = applyHEStainToCanvas

window.applyHEStainToCanvas = function(canvas, config) {
  const start = performance.now()
  original.call(this, canvas, config)
  const time = performance.now() - start
  if (time > 16) { // More than 1 frame at 60fps
    console.warn(`H&E processing slow: ${time.toFixed(2)}ms`)
  }
}
```

Or use DevTools Performance tab:
1. F12 → Performance tab
2. Click record
3. Enable H&E
4. Interact with viewer (pan, zoom)
5. Stop recording
6. Look for "applyHEStainToCanvas" in timeline

## Common Issues & Fixes

### Issue: "Canvas has zero dimensions"
**Cause**: Canvas exists but hasn't been rendered yet
**Fix**: Wait a moment after page load before enabling H&E, or ensure canvas has rendered first

### Issue: "Failed to get canvas context"
**Cause**: Canvas doesn't support 2D context
**Fix**: This is very rare; usually indicates browser issue. Try different browser.

### Issue: Post-processing runs but colors don't change
**Cause**: 
1. Channel extraction is wrong (extracting wrong color components)
2. Viv isn't rendering channels with expected colors
3. Mixing algorithm isn't producing correct colors

**Debug**:
```javascript
// Check what Viv is actually rendering
const canvas = document.querySelector('canvas')
const ctx = canvas.getContext('2d')
const imageData = ctx.getImageData(0, 0, 1, 1)
const [r, g, b] = imageData.data

// If this shows something other than green [0, 255, 0],
// then Viv is rendering differently than expected
console.log('Nucleus channel color:', [r, g, b])
```

### Issue: Colors are inverted or wrong
**Cause**: Nucleus/Cytoplasm assignments are backwards

**Fix**: In Navigation Controls, swap which channel is assigned to Nucleus vs Cytoplasm

### Issue: Processing crashes the browser
**Cause**: Infinite loop or memory leak in requestAnimationFrame
**Fix**: 
1. Disable H&E to stop processing
2. Check console for errors
3. Restart browser

## Performance Tips

1. **Disable when not needed**: H&E post-processing uses ~5-10% CPU
2. **Zoom out**: Fewer pixels = faster processing
3. **Reduce canvas size**: Smaller canvas = less work
4. **Future**: Will add GPU acceleration (currently CPU-only)

## Monitoring Performance

```javascript
// Log FPS of H&E processing
let frameCount = 0
let lastTime = performance.now()

setInterval(() => {
  const now = performance.now()
  const fps = frameCount / ((now - lastTime) / 1000)
  console.log(`H&E Processing FPS: ${fps.toFixed(1)}`)
  frameCount = 0
  lastTime = now
}, 1000)

// Then in applyHEStainToCanvas, increment frameCount each call
```

## Expected Behavior

### Timeline of Events

1. **User loads image**
   - Canvas renders with Viv (green nucleus, red cytoplasm)
   - H&E processing OFF

2. **User toggles H&E ON**
   - Console shows color generation logs
   - useEffect hook runs
   - setupCanvasHEProcessing() starts requestAnimationFrame loop
   - Each frame, canvas is processed with H&E mixing
   - Colors on canvas gradually become blue-purple and pink-red

3. **User toggles H&E OFF**
   - requestAnimationFrame loop is cancelled
   - Canvas stops being post-processed
   - Viv re-renders with original green/red colors

4. **User adjusts contrast**
   - Viv re-renders (colors change intensity)
   - H&E post-processor automatically sees new colors
   - Mixing applied to new colors
   - Display updates with new H&E result

## Advanced: Manual Testing

You can test the post-processor manually:

```javascript
import { applyHEStainToCanvas } from '@/lib/utils/canvasHEStainProcessor'

const canvas = document.querySelector('canvas')
applyHEStainToCanvas(canvas, {
  enabled: true,
  channelMap: { nucleus: 0, cytoplasm: 1, background: null },
  dataType: 'uint16'
})
```

This should immediately apply H&E mixing to whatever is on the canvas.

---

Use these debugging steps to verify every part of the pipeline is working correctly!
