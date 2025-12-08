# Troubleshooting: H&E Colors Not Showing

## Quick Check

If H&E colors aren't appearing, follow this checklist:

### ✅ Step 1: Verify Toggle Is Enabled

1. Open Navigation Controls (click "Controls" button, top-right)
2. Go to **Contrast** section
3. Look for **"H&E Staining"** toggle
   - If toggle is **checked** → go to Step 2
   - If toggle is **disabled (greyed out)** → go to Issue #1
   - If toggle is **not visible** → go to Issue #2

### ✅ Step 2: Verify Channels Are Selected

1. Go to **Channels** section
2. Check **Nucleus** dropdown
   - Should show a channel number (0, 1, 2, etc.)
   - Should NOT say "Select Channel"
3. Check **Cytoplasm** dropdown
   - Should show a channel number
   - Should NOT say "Select Channel"

If both are selected → **H&E should be working**, continue to Step 3
If either is missing → go to **Issue #1**

### ✅ Step 3: Verify Colors Are Correct

1. Enable **Histogram Equalization** (in Contrast section)
2. Look at the 2D image viewer
3. You should see:
   - **Nucleus regions**: Blue-purple color (#A314CC)
   - **Cytoplasm regions**: Pink-red color (#36190A)

If you see these colors → **✅ H&E IS WORKING!**
If you see green/red instead → go to **Issue #3**
If image is blank → go to **Issue #4**

---

## Issues & Solutions

### Issue #1: H&E Toggle Is Disabled

**Symptom**: Toggle is greyed out / unchecked and can't be clicked

**Cause**: One or both channels are not selected

**Solution**:
1. Go to **Channels** section
2. Select **Nucleus** channel (pick one: 0, 1, 2, etc.)
3. Select **Cytoplasm** channel (pick a different one)
4. Go back to **Contrast** section
5. H&E toggle should now be enabled ✅

**If still disabled**:
- Check if you have at least 2 channels in your data
- Some datasets only have 1 channel
- In that case, H&E rendering isn't applicable

---

### Issue #2: H&E Toggle Not Visible

**Symptom**: Can't find H&E toggle in Contrast section

**Cause**: Component not rendered, or interface issue

**Solution**:

1. **Refresh the page** (Ctrl+R or Cmd+R)
2. Open Controls again
3. Look in **Contrast** section for "H&E Staining"

If still not visible:
1. Open browser console (F12)
2. Check for error messages
3. Look for warnings about missing components

If there are console errors:
- Take a screenshot of the error
- Check that all files are properly imported
- Verify no build errors

---

### Issue #3: Toggle Works But Colors Don't Change

**Symptom**: Toggle can be turned ON, but image stays green/red

**Cause**: Colors not being passed to Viv viewer

**Solution**:

1. **Check Histogram Equalization**
   - Turn on "Histogram Equalization" in Contrast section
   - Sometimes colors are too subtle to see without contrast boost
   - Image should become much clearer

2. **Check Contrast Limits**
   - Adjust the contrast limit sliders
   - If range is too narrow, colors might not be visible

3. **Check image data**
   - Make sure image actually has data in both channels
   - Try selecting different channels to see if they have data

If colors still don't change:
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify `navigationState.heStainingOn` is true when toggle is ON
4. Check that `useVivViewer` is receiving the updated colors array

---

### Issue #4: Image Viewer Is Blank

**Symptom**: No image visible in 2D viewer, even with H&E OFF

**Cause**: Zarr data not loaded, or Viv viewer not initialized

**Solution**:

1. **Check Zarr store URL**
   - Go back to home page
   - Verify you entered correct Zarr store URL
   - Check that URL is accessible

2. **Check console errors**
   - Open browser console (F12)
   - Look for network errors or fetch failures
   - Look for Zarr loading errors

3. **Wait for data**
   - Large datasets take time to load
   - Wait 10-30 seconds before interacting
   - Check Network tab in DevTools to see if data is still loading

4. **Check browser cache**
   - Clear browser cache
   - Close and reopen the page
   - Try in an incognito window

If still blank:
- The Zarr data might be inaccessible
- Check that you have the correct URL
- Check CORS settings on the server
- Try a different dataset

---

## Expected Behavior

### When H&E Is ON (and working correctly):

```
Toggle position: Checked ✓
Nucleus color: Blue-purple [163, 20, 204] / #A314CC
Cytoplasm color: Pink-red [54, 25, 10] / #36190A
Appearance: Resembles traditional histology slides
```

### When H&E Is OFF:

```
Toggle position: Unchecked ☐
Nucleus color: Green [0, 255, 0] / #00FF00
Cytoplasm color: Red [255, 0, 0] / #FF0000
Appearance: High-contrast false-color
```

### When Channel Missing:

```
Toggle position: Disabled (greyed out)
Warning message: "H&E staining requires both nucleus and cytoplasm..."
Action: Select missing channel in Channels section
```

---

## Console Commands (For Debugging)

If you're comfortable with browser console, try these:

```javascript
// Check if state is updating
// (In browser console)

// Check navigationState
// Should show heStainingOn: true when toggle is ON
window.navigationState?.heStainingOn

// Check colors being generated
// Should be [[163, 20, 204], [54, 25, 10]] when H&E ON
window.colors

// Check if Viv viewer exists
// Should be a Viv instance
window.vivViewer
```

---

## Still Not Working?

If none of the above solutions work:

1. **Take a screenshot** of:
   - Navigation Controls panel
   - Toggle position
   - Any error messages in console

2. **Check these details**:
   - What Zarr dataset are you using?
   - How many channels does it have?
   - Are channels 0 and 1 the nucleus and cytoplasm?

3. **Try the steps again**:
   - Refresh page (Ctrl+R)
   - Select Nucleus channel
   - Select Cytoplasm channel
   - Toggle H&E ON
   - Enable Histogram Equalization

4. **Check the code**:
   - `useVivViewer.ts` lines 140-180 should have color generation
   - `navigator.tsx` lines 215-235 should have H&E toggle UI
   - Colors should be correct in console

---

## Common Mistakes

### ❌ Mistake 1: Selecting Same Channel Twice
- **Problem**: Can't select nucleus and cytoplasm both as "Channel 0"
- **Solution**: Pick different channels (e.g., Nucleus=0, Cytoplasm=1)

### ❌ Mistake 2: Not Waiting For Data
- **Problem**: Toggling H&E before data loads
- **Solution**: Wait for image to appear before toggling

### ❌ Mistake 3: Contrast Too Low
- **Problem**: Colors too subtle to see
- **Solution**: Enable Histogram Equalization or boost contrast limits

### ❌ Mistake 4: Looking At Wrong Section
- **Problem**: Looking for H&E in Channels section
- **Solution**: H&E toggle is in **Contrast** section, not Channels

---

## Success Indicators

You've successfully enabled H&E staining when:

✅ H&E toggle is checked  
✅ Both nucleus and cytoplasm channels selected  
✅ Nucleus regions appear blue-purple  
✅ Cytoplasm regions appear pink-red  
✅ Colors look like traditional H&E histology  
✅ No console errors  
✅ Toggling OFF switches colors to green/red  

If all of these are true, **H&E is working!** 🎉

---

## Quick Reference

| Problem | Solution |
|---------|----------|
| Toggle disabled | Select both nucleus and cytoplasm channels |
| Toggle not visible | Refresh page, check console for errors |
| Colors don't change | Enable Histogram Equalization, check contrast |
| Image blank | Check Zarr URL, wait for data load, check console |
| Still stuck | Take screenshot, check code, try again from Step 1 |

Remember: **H&E colors are [163, 20, 204] for nucleus and [54, 25, 10] for cytoplasm.** If you see different colors, H&E might not be enabled or Viv isn't rendering with these colors.
