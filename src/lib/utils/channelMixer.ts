/**
 * Channel mixing utilities for false-color rendering
 * Implements H&E pseudo-coloring based on FalseColor methodology
 * 
 * H&E PSEUDO-COLOR RENDERING PIPELINE
 * ====================================
 * 
 * 1. PIXEL-LEVEL NON-LINEAR TRANSFORMATION (heStainTransform.ts)
 *    - Applies non-linear mixing of nucleus and cytoplasm channels
 *    - Uses multiplicative damping model to create realistic H&E appearance
 *    - Formulas:
 *      * Hematoxylin = nucleus_stain × pow(1 - cytoplasm_stain × 0.6, 0.9)
 *      * Eosin = cytoplasm_stain × pow(1 - nucleus_stain × 0.6, 0.9)
 *    - Generates intensity maps that represent stain presence, not raw fluorescence
 *    - See: computeHEStainTransform() in heStainTransform.ts
 * 
 * 2. COLOR ASSIGNMENT (useVivViewer.ts)
 *    - Assigns H&E colors to transformed channels:
 *      * Hematoxylin intensity → Blue-purple [163, 20, 204]
 *      * Eosin intensity → Pink-red [54, 25, 10]
 *    - Viv applies these colors during WebGL rendering
 *    - Each pixel: output_color = pixel_intensity × assigned_color
 * 
 * 3. CONTRAST ADJUSTMENT (heStainTransform.ts)
 *    - Non-linear transformation reduces perceived intensity range
 *    - Apply 1.2x boost to contrast limits to compensate
 *    - Ensures optimal visual appearance without manual adjustment
 * 
 * RESULT: Authentic H&E pseudo-color appearance
 * - Nucleus-only regions: blue-purple (hematoxylin)
 * - Cytoplasm-only regions: pink-red (eosin)
 * - Mixed regions: mauve/gray tones
 * 
 * References:
 * - https://github.com/serrob23/FalseColor
 * - Giacomelli et al. (https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0159337)
 * - Serafin et al. (https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0233198)
 */

import type { ChannelMapping } from '../../types/viewer2D/navTypes'

/**
 * Standard H&E (Hematoxylin & Eosin) stain RGB values
 * Hematoxylin: nucleus/chromatin (blue-purple in real H&E)
 * Eosin: cytoplasm/background (pink-red in real H&E)
 */
export const HE_STAIN_COLORS = {
  hematoxylin: [0.64, 0.08, 0.80],  // Blue-purple for nucleus
  eosin: [0.21, 0.10, 0.04],        // Pink-red for cytoplasm
  background: [1.0, 1.0, 1.0]       // White background (light color = no stain)
} as const

/**
 * Configuration for how to mix channels into RGB
 */
export interface ChannelMixConfig {
  nucleusChannelIndex?: number | null
  cytoplasmChannelIndex?: number | null
  // Future: add more channel types
}

/**
 * Describes a channel mix strategy
 */
export type ChannelMixStrategy = 'separate' | 'falsecolor' | 'he-stain' | 'custom'

/**
 * H&E pseudo-color stain separation algorithm
 * 
 * Converts two-channel fluorescence data into H&E histopathology color space.
 * The algorithm implements stain unmixing to create a pseudo-colored image that
 * resembles traditional H&E staining.
 * 
 * @param nucleusData - Uint8 or Uint16 array of nucleus channel values (corresponds to Hematoxylin)
 * @param cytoplasmData - Uint8 or Uint16 array of cytoplasm channel values (corresponds to Eosin)
 * @param nucleusScale - Scale factor to normalize nucleus data (e.g., 255 for uint8, 65535 for uint16)
 * @param cytoplasmScale - Scale factor to normalize cytoplasm data
 * @returns RGB data interleaved as [R, G, B, R, G, B, ...]
 * 
 * H&E Color Space:
 * - Nucleus high, Cytoplasm low     → Hematoxylin dominant (purple-blue)
 * - Nucleus low, Cytoplasm high     → Eosin dominant (pink-red)
 * - Nucleus high, Cytoplasm high    → Mixed (mauve/gray-purple)
 * - Neither high                     → Background white
 */
export function mixChannelsToHEStain(
  nucleusData: Uint8Array | Uint16Array | null,
  cytoplasmData: Uint8Array | Uint16Array | null,
  nucleusScale: number = 255,
  cytoplasmScale: number = 255
): Uint8Array {
  // Determine output size
  const inputLength = nucleusData?.length || cytoplasmData?.length || 0
  const outputLength = inputLength * 3 // RGB output

  const result = new Uint8Array(outputLength)

  // H&E stain colors in 0-1 range
  const hematoxylin = HE_STAIN_COLORS.hematoxylin
  const eosin = HE_STAIN_COLORS.eosin
  const background = HE_STAIN_COLORS.background

  for (let i = 0; i < inputLength; i++) {
    // Normalize channel values to 0-1 range (inverted because fluorescence intensity = stain absence)
    const nucleusNorm = nucleusData ? 1.0 - Math.min(nucleusData[i] / nucleusScale, 1.0) : 0.0
    const cytoplasmNorm = cytoplasmData ? 1.0 - Math.min(cytoplasmData[i] / cytoplasmScale, 1.0) : 0.0

    // Blend between background (no stain) and stains based on intensity
    // Higher fluorescence value = less stain present (inverted relationship)
    let r = background[0]
    let g = background[1]
    let b = background[2]

    // Apply hematoxylin (nucleus stain) contribution
    r = r * (1 - nucleusNorm) + hematoxylin[0] * nucleusNorm
    g = g * (1 - nucleusNorm) + hematoxylin[1] * nucleusNorm
    b = b * (1 - nucleusNorm) + hematoxylin[2] * nucleusNorm

    // Apply eosin (cytoplasm stain) contribution
    r = r * (1 - cytoplasmNorm) + eosin[0] * cytoplasmNorm
    g = g * (1 - cytoplasmNorm) + eosin[1] * cytoplasmNorm
    b = b * (1 - cytoplasmNorm) + eosin[2] * cytoplasmNorm

    // Clamp values to 0-255 range and convert to uint8
    const r8 = Math.min(255, Math.max(0, Math.round(r * 255)))
    const g8 = Math.min(255, Math.max(0, Math.round(g * 255)))
    const b8 = Math.min(255, Math.max(0, Math.round(b * 255)))

    // Write interleaved RGB
    result[i * 3] = r8
    result[i * 3 + 1] = g8
    result[i * 3 + 2] = b8
  }

  return result
}

/**
 * Creates a composite channel mixer based on channel map with H&E stain rendering
 * Returns a function that can be called to mix multiple channel arrays into H&E RGB
 * 
 * @param channelMap - Mapping of roles (nucleus, cytoplasm) to channel indices
 * @param dataType - Data type of input channels ('uint8' or 'uint16')
 * @returns Mixer object with helper properties and mix function
 */
export function createHEStainMixer(
  channelMap: ChannelMapping,
  dataType: 'uint8' | 'uint16' = 'uint16'
) {
  const nucleusChannelIndex = channelMap.nucleus
  const cytoplasmChannelIndex = channelMap.cytoplasm

  // Scale factors for normalization
  const scaleMap: Record<'uint8' | 'uint16', number> = {
    uint8: 255,
    uint16: 65535
  }

  return {
    hasNucleus: nucleusChannelIndex !== null,
    hasCytoplasm: cytoplasmChannelIndex !== null,
    /**
     * Mix multiple channel arrays into H&E pseudo-colored RGB
     * @param channelDataMap - Object with channel index → data mapping
     * @returns RGB Uint8Array suitable for display
     */
    mix: (channelDataMap: Record<number, Uint8Array | Uint16Array>) => {
      const nucleusData = nucleusChannelIndex !== null ? channelDataMap[nucleusChannelIndex] : null
      const cytoplasmData = cytoplasmChannelIndex !== null ? channelDataMap[cytoplasmChannelIndex] : null

      return mixChannelsToHEStain(
        nucleusData as Uint8Array | Uint16Array | null,
        cytoplasmData as Uint8Array | Uint16Array | null,
        scaleMap[dataType],
        scaleMap[dataType]
      )
    }
  }
}

/**
 * Determines if both nucleus and cytoplasm channels are selected
 * This indicates the user wants H&E pseudo-color rendering
 */
export function shouldUseHEStaining(channelMap: ChannelMapping): boolean {
  return channelMap.nucleus !== null && channelMap.cytoplasm !== null
}

/**
 * Get rendering mode based on channel selection
 * @returns 'single' if only one channel, 'dual' if both nucleus and cytoplasm
 */
export function getRenderingMode(channelMap: ChannelMapping): 'single' | 'dual' {
  const mappedChannels = Object.values(channelMap).filter(c => c !== null).length
  return mappedChannels >= 2 ? 'dual' : 'single'
}

/**
 * Legacy false-color mixer (kept for backward compatibility)
 * Creates simple separate channel rendering with fixed colors
 */
export function mixChannelsToRGB(
  nucleusData: Uint8Array | Uint16Array | null,
  cytoplasmData: Uint8Array | Uint16Array | null,
  nucleusScale: number = 255,
  cytoplasmScale: number = 255
): Uint8Array {
  // Determine output size
  const inputLength = nucleusData?.length || cytoplasmData?.length || 0
  const outputLength = inputLength * 3 // RGB output

  const result = new Uint8Array(outputLength)

  for (let i = 0; i < inputLength; i++) {
    // Normalize nucleus to 0-255 range (green channel)
    const nucValue = nucleusData ? Math.round((nucleusData[i] / nucleusScale) * 255) : 0
    // Normalize cytoplasm to 0-255 range (red channel)
    const cytValue = cytoplasmData ? Math.round((cytoplasmData[i] / cytoplasmScale) * 255) : 0
    // Blue channel unused (set to 0)
    const blueValue = 0

    // Write interleaved RGB
    result[i * 3] = cytValue      // R - cytoplasm
    result[i * 3 + 1] = nucValue   // G - nucleus
    result[i * 3 + 2] = blueValue  // B - unused
  }

  return result
}

/**
 * Legacy factory for false-color mixer (kept for backward compatibility)
 */
export function createChannelMixer(
  channelMap: ChannelMapping,
  dataType: 'uint8' | 'uint16' = 'uint16'
) {
  const nucleusChannelIndex = channelMap.nucleus
  const cytoplasmChannelIndex = channelMap.cytoplasm

  // Scale factors for normalization
  const scaleMap: Record<'uint8' | 'uint16', number> = {
    uint8: 255,
    uint16: 65535
  }

  return {
    hasNucleus: nucleusChannelIndex !== null,
    hasCytoplasm: cytoplasmChannelIndex !== null,
    mix: (channelDataMap: Record<number, Uint8Array | Uint16Array>) => {
      const nucleusData = nucleusChannelIndex !== null ? channelDataMap[nucleusChannelIndex] : null
      const cytoplasmData = cytoplasmChannelIndex !== null ? channelDataMap[cytoplasmChannelIndex] : null

      return mixChannelsToRGB(
        nucleusData as Uint8Array | Uint16Array | null,
        cytoplasmData as Uint8Array | Uint16Array | null,
        scaleMap[dataType],
        scaleMap[dataType]
      )
    }
  }
}
