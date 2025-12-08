/**
 * Non-linear H&E pseudo-color transformation utilities
 * 
 * Implements pixel-level transformations that depend on both nucleus and cytoplasm
 * channels simultaneously to create authentic H&E pseudo-color rendering.
 * 
 * The key insight: H&E staining is not just about color assignment.
 * It requires non-linear mixing of the two channels to create:
 * - Pure hematoxylin (nucleus strong, cytoplasm weak) → blue-purple
 * - Pure eosin (nucleus weak, cytoplasm strong) → pink-red
 * - Mixed (both strong) → mauve/gray
 */

/**
 * Computes non-linear transformation matrix for H&E staining
 * 
 * This applies a non-linear transfer function to pixel data that depends
 * on BOTH nucleus and cytoplasm values simultaneously.
 * 
 * ⚠️ ARCHITECTURAL NOTE: This function is NOT currently called during rendering.
 * 
 * Why not integrated into active rendering?
 * - Viv uses WebGL rendering (GPU-accelerated via deck.gl)
 * - WebGL canvases don't expose raw pixel access to JavaScript
 * - Per-pixel transformation would require shader customization (not available in Viv)
 * - Current approach uses color assignment + contrast boost (works within constraints)
 * 
 * This function is kept because:
 * - It's mathematically correct for H&E pseudo-coloring
 * - Could be used for offline image processing (export, batch processing)
 * - Documents the intended non-linear transformation model
 * - May become useful if Viv adds shader customization support
 * 
 * The transformation creates the following effects:
 * - High nucleus, low cytoplasm → enhance nucleus channel
 * - Low nucleus, high cytoplasm → enhance cytoplasm channel
 * - Both high → intermediate mixing (creates mauve tones)
 * 
 * @param nucleusValue - Normalized nucleus channel (0-1)
 * @param cytoplasmValue - Normalized cytoplasm channel (0-1)
 * @returns Object with transformed intensity for each component
 */
export function computeHEStainTransform(
  nucleusValue: number,
  cytoplasmValue: number
): {
  hematoxylinIntensity: number
  eosinIntensity: number
} {
  // Clamp inputs to 0-1 range
  const n = Math.max(0, Math.min(1, nucleusValue))
  const c = Math.max(0, Math.min(1, cytoplasmValue))

  // Non-linear stain unmixing model
  // IMPORTANT: This assumes direct staining (high nucleus channel = nucleus present)
  // If using negative staining or autofluorescence, uncomment the inversion below
  
  // For positive staining (ACTIVE):
  // Nucleus channel intensity directly indicates nucleus presence
  // Cytoplasm channel intensity directly indicates cytoplasm presence
  const nucleusStain = n
  const cytoplasmStain = c

  /* For negative staining (DISABLED):
  // Uncomment below if using negative staining where low signal = presence
  const nucleusStain = 1.0 - n
  const cytoplasmStain = 1.0 - c
  */

  // Non-linear enhancement using power functions
  // This creates stronger separation between nucleus and cytoplasm regions
  
  // Hematoxylin intensity: dominant when nucleus signal is high
  // Use multiplicative damping from cytoplasm to prevent over-mixing
  const hematoxylinIntensity = nucleusStain * Math.pow(1.0 - cytoplasmStain * 0.6, 0.9)

  // Eosin intensity: dominant when cytoplasm signal is high
  // Use multiplicative damping from nucleus to prevent over-mixing
  const eosinIntensity = cytoplasmStain * Math.pow(1.0 - nucleusStain * 0.6, 0.9)

  return {
    hematoxylinIntensity: Math.max(0, Math.min(1, hematoxylinIntensity)),
    eosinIntensity: Math.max(0, Math.min(1, eosinIntensity))
  }
}

/**
 * Pre-compute lookup tables (LUTs) for efficient H&E transformation
 * 
 * Creates discrete lookup tables that can be applied in real-time during rendering
 * without computing the non-linear function for every pixel.
 * 
 * @param resolution - Number of levels in the LUT (e.g., 256 for uint8, 65536 for uint16)
 * @returns 2D array where lut[nucleus][cytoplasm] gives { hematoxylin, eosin }
 */
export function createHEStainLUT(resolution: number = 256): Float32Array[] {
  const lut: Float32Array[] = []

  for (let n = 0; n < resolution; n++) {
    const nucleusNorm = n / (resolution - 1)
    const row = new Float32Array(resolution * 2) // Store [h, e, h, e, ...]

    for (let c = 0; c < resolution; c++) {
      const cytoplasmNorm = c / (resolution - 1)
      const { hematoxylinIntensity, eosinIntensity } = computeHEStainTransform(
        nucleusNorm,
        cytoplasmNorm
      )

      row[c * 2] = hematoxylinIntensity
      row[c * 2 + 1] = eosinIntensity
    }

    lut[n] = row
  }

  return lut
}

/**
 * Creates a transfer function that applies non-linear H&E transformation
 * 
 * This function can be called for each pixel pair (nucleus, cytoplasm)
 * to get the transformed intensity values that should be sent to the renderer.
 * 
 * The transformation preserves the information from both channels but
 * remaps it to create authentic H&E pseudo-color appearance.
 */
export function createHEStainTransferFunction(
  scale: number = 255  // 255 for uint8, 65535 for uint16
): (nucleusValue: number, cytoplasmValue: number) => [number, number] {
  return (nucleusValue: number, cytoplasmValue: number): [number, number] => {
    const nucleusNorm = nucleusValue / scale
    const cytoplasmNorm = cytoplasmValue / scale

    const { hematoxylinIntensity, eosinIntensity } = computeHEStainTransform(
      nucleusNorm,
      cytoplasmNorm
    )
    
    return [
      Math.round(hematoxylinIntensity * scale),
      Math.round(eosinIntensity * scale)
    ]
  }
}

/**
 * Contrasts enhancement for H&E rendering
 * 
 * Automatically adjusts contrast limits for nucleus and cytoplasm channels
 * when H&E staining is enabled. This ensures optimal visual appearance
 * by accounting for the non-linear transformation.
 * 
 * @param originalNucleusContrast - Original contrast limit for nucleus channel
 * @param originalCytoplasmContrast - Original contrast limit for cytoplasm channel
 * @returns Adjusted contrast limits for H&E rendering
 */
export function adjustContrastForHEStaining(
  originalNucleusContrast: number,
  originalCytoplasmContrast: number
): {
  adjustedNucleusContrast: number
  adjustedCytoplasmContrast: number
} {
  // The non-linear transformation can affect perceived contrast
  // Apply a 1.2x boost to compensate for the reduced range from mixing
  const boostFactor = 1.2

  return {
    adjustedNucleusContrast: originalNucleusContrast * boostFactor,
    adjustedCytoplasmContrast: originalCytoplasmContrast * boostFactor
  }
}

/**
 * Analyze dual-channel data to recommend optimal H&E staining parameters
 * 
 * Can be used to automatically adjust transformation parameters based
 * on the actual data distribution.
 */
export interface HEStainingAnalysis {
  nucleusMedian: number
  cytoplasmMedian: number
  nucleusMean: number
  cytoplasmMean: number
  nucleusRange: [number, number]
  cytoplasmRange: [number, number]
}

export function analyzeChannelsForHEStaining(
  nucleusData: Uint8Array | Uint16Array,
  cytoplasmData: Uint8Array | Uint16Array
): HEStainingAnalysis {
  // This is a placeholder - real implementation would analyze histogram
  // For now, return basic statistics
  let nucleusMin = Infinity
  let nucleusMax = -Infinity
  let cytoplasmMin = Infinity
  let cytoplasmMax = -Infinity
  let nucleusSum = 0
  let cytoplasmSum = 0

  for (let i = 0; i < nucleusData.length; i++) {
    nucleusMin = Math.min(nucleusMin, nucleusData[i])
    nucleusMax = Math.max(nucleusMax, nucleusData[i])
    nucleusSum += nucleusData[i]
    cytoplasmMin = Math.min(cytoplasmMin, cytoplasmData[i])
    cytoplasmMax = Math.max(cytoplasmMax, cytoplasmData[i])
    cytoplasmSum += cytoplasmData[i]
  }

  return {
    nucleusMedian: (nucleusMin + nucleusMax) / 2,
    cytoplasmMedian: (cytoplasmMin + cytoplasmMax) / 2,
    nucleusMean: nucleusSum / nucleusData.length,
    cytoplasmMean: cytoplasmSum / cytoplasmData.length,
    nucleusRange: [nucleusMin, nucleusMax],
    cytoplasmRange: [cytoplasmMin, cytoplasmMax]
  }
}
