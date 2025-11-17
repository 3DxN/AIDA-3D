# H&E Non-Linear Transformation: Mathematical Foundations

## Problem Statement

Given:
- **n_raw** = nucleus channel intensity [0, scale] where scale=255 for uint8, 65535 for uint16
- **c_raw** = cytoplasm channel intensity [0, scale]

Find transformation T such that:
- T(n_raw=high, c_raw=low) → (H≈1, E≈0) [Blue-purple nucleus]
- T(n_raw=low, c_raw=high) → (H≈0, E≈1) [Pink-red cytoplasm]
- T(n_raw=mid, c_raw=mid) → (H≈0.5, E≈0.5) [Mauve mixed]
- T(n_raw=high, c_raw=high) → (H<0.5, E<0.5) [Desaturated/gray]

## Solution: Multiplicative Damping with Stain Inversion

### Formulation

```
n = n_raw / scale                      (normalize to [0, 1])
c = c_raw / scale                      (normalize to [0, 1])

h = 1 - n                              (nucleus stain - invert fluorescence)
e = 1 - c                              (cytoplasm stain - invert fluorescence)

H = h × pow(1 - e × 0.6, 0.9)          (Hematoxylin intensity)
E = e × pow(1 - h × 0.6, 0.9)          (Eosin intensity)
```

### Why Invert (1 - value)?

The inversion model is based on **fluorescence microscopy principle**:
- High fluorescence intensity = Little/no staining
- Low fluorescence intensity = Strong staining (dye present)

This is typical for:
- GFP/antibody staining (bright = high signal, but stain interpretation inverted)
- Tissue autofluorescence
- Counterstaining with fluorescent dyes

If your data is from brightfield H&E scans (NOT fluorescence), this inversion might need adjustment.

## Mathematical Validation

### Test Case 1: Pure Nucleus (n=0.95, c=0.05)
```
h = 1 - 0.95 = 0.05
e = 1 - 0.05 = 0.95

H = 0.05 × pow(1 - 0.95 × 0.6, 0.9)
  = 0.05 × pow(1 - 0.57, 0.9)
  = 0.05 × pow(0.43, 0.9)
  ≈ 0.05 × 0.445
  ≈ 0.022 (LOW)

E = 0.95 × pow(1 - 0.05 × 0.6, 0.9)
  = 0.95 × pow(1 - 0.03, 0.9)
  = 0.95 × pow(0.97, 0.9)
  ≈ 0.95 × 0.969
  ≈ 0.920 (HIGH)

Result: H=0.022, E=0.920 → Pink-red
```

### Test Case 2: Pure Cytoplasm (n=0.05, c=0.95)
```
h = 1 - 0.05 = 0.95
e = 1 - 0.95 = 0.05

H = 0.95 × pow(1 - 0.05 × 0.6, 0.9)
  = 0.95 × pow(0.97, 0.9)
  ≈ 0.920 (HIGH)

E = 0.05 × pow(1 - 0.95 × 0.6, 0.9)
  ≈ 0.022 (LOW)

Result: H=0.920, E=0.022 → Blue-purple
```

### Test Case 3: Mixed Regions (n=0.5, c=0.5)
```
h = 1 - 0.5 = 0.5
e = 1 - 0.5 = 0.5

H = 0.5 × pow(1 - 0.5 × 0.6, 0.9)
  = 0.5 × pow(0.7, 0.9)
  ≈ 0.5 × 0.707
  ≈ 0.354

E = 0.5 × pow(1 - 0.5 × 0.6, 0.9)
  ≈ 0.354

Result: H=0.354, E=0.354 → Balanced mauve
```

### Test Case 4: Both Saturated (n=0.95, c=0.95)
```
h = 1 - 0.95 = 0.05
e = 1 - 0.95 = 0.05

H = 0.05 × pow(1 - 0.05 × 0.6, 0.9)
  = 0.05 × pow(0.97, 0.9)
  ≈ 0.049

E = 0.05 × pow(1 - 0.05 × 0.6, 0.9)
  ≈ 0.049

Result: H=0.049, E=0.049 → Very light (nearly white)
```

### Test Case 5: Background (n=0.01, c=0.01)
```
h = 1 - 0.01 = 0.99
e = 1 - 0.01 = 0.99

H = 0.99 × pow(1 - 0.99 × 0.6, 0.9)
  = 0.99 × pow(0.406, 0.9)
  ≈ 0.99 × 0.421
  ≈ 0.417

E = 0.99 × pow(1 - 0.99 × 0.6, 0.9)
  ≈ 0.417

Result: H=0.417, E=0.417 → Gray
```

**OBSERVATION**: The inversion model treats LOW signal as HIGH stain. This is backwards for a fluorescence nucleus/cytoplasm system!

## Corrected Interpretation

The formula actually represents:
- **h = 1 - n** = "background fluorescence minus nucleus signal"
- This inverts the semantic meaning

For a correct implementation WITHOUT inversion:
```
H = n × pow(1 - c × 0.6, 0.9)
E = c × pow(1 - n × 0.6, 0.9)
```

But the **current implementation uses inversion**, which may be intentional if:
1. Data is from **negative staining** (low signal = presence)
2. Data needs inverted interpretation
3. Color inversion is applied elsewhere in the pipeline

## Algorithm Components Explained

### 1. Normalization (n = n_raw / scale)
- Converts arbitrary bit-depth to standard [0, 1] range
- Enables parameter tuning independent of bit-depth
- uint8: divide by 255
- uint16: divide by 65535

### 2. Stain Inversion (h = 1 - n)
- Inverts the signal interpretation
- Must be REMOVED if data is positive staining
- Must be KEPT if data is negative staining or autofluorescence

### 3. Multiplicative Damping (1 - stain × 0.6)
- Each channel suppresses the other by 60%
- Factor 0.6:
  - Lower (0.3): less mixing, more saturated
  - Higher (0.8): more mixing, more gray
- Prevents simultaneous blue + red = white

### 4. Power Function (pow(x, 0.9))
- Non-linear curve transformation
- 0.9 < 1: de-emphasizes lower values
- Creates smooth S-curve instead of linear interpolation
- Exponent 0.9:
  - Lower (0.7): sharper transitions
  - Higher (1.1): softer transitions

## Impact on Different Data Types

### Fluorescence Microscopy (GFP/Antibodies)
- **Typical characteristic**: Bright signal where protein is present
- **With inversion**: Signal = 255 → stain = 0 (WRONG semantics)
- **Recommendation**: Consider removing inversion

### Brightfield Histology (Real H&E)
- **Typical characteristic**: Dark where stain is present
- **With inversion**: Low signal → high stain (CORRECT)
- **Recommendation**: Keep inversion

### Two-Channel Fluorescence (Nucleus + Cytoplasm)
- **Typical characteristic**: Nucleus bright in one channel, cytoplasm in another
- **With inversion**: Semantic mismatch
- **Recommendation**: REMOVE inversion

## Configuration Guide

### Default Configuration (Current)
```typescript
const nucleusStain = 1.0 - nucleusNorm           // Inverts
const cytoplasmStain = 1.0 - cytoplasmNorm       // Inverts
const dampingFactor = 0.6
const exponent = 0.9
```

### For Positive Staining (Recommended for Nucleus/Cytoplasm Markers)
Edit `heStainTransform.ts` line 44-45:
```typescript
const nucleusStain = nucleusNorm                 // NO inversion
const cytoplasmStain = cytoplasmNorm             // NO inversion
```

### For More Saturated Colors
Edit `heStainTransform.ts` line ~51:
```typescript
const dampingFactor = 0.4  // Less mixing
```

### For Sharper Transitions
Edit `heStainTransform.ts` line ~51:
```typescript
const exponent = 0.7  // Sharper
```

## Performance Analysis

**Computation per pixel:**
- 2 subtractions (inversion)
- 2 multiplications (damping setup)
- 2 power functions (most expensive)
- 2 multiplications (apply damping)
- Total: ~6 CPU operations

**For 4K image (3840×2160):**
- ~50 million pixels
- ~0.3 billion operations
- Modern CPU: ~100 CPU operations/ns
- **Estimated time: 3 milliseconds**

**Note**: Current implementation applies transformation at color assignment level (not per-pixel), so performance impact is negligible.

## References

- **Stain normalization**: Macenko et al., 2009 ("A method for normalizing histology slides for quantitative analysis")
- **Stain separation**: Ruifrok & Johnston, 2001 ("Quantification of histochemical staining by color deconvolution")
- **Multiplicative mixing**: Based on Beer-Lambert law for optical density
- **Power functions**: Standard in image processing for contrast manipulation

## Recommendations

1. **Test with actual data**: Verify inversion assumption
2. **Check semantics**: Is high signal = presence or absence?
3. **Visual validation**: Compare with standard H&E samples
4. **Fine-tune parameters**: Adjust damping and exponent based on results
5. **Document configuration**: Record which model version is being used

