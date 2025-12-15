/**
 * Channel mixing utilities for false-color rendering
 *
 * This module provides helper functions for determining rendering modes
 * and color constants. The actual H&E Beer-Lambert transformation is now
 * handled by HEStainExtension (deck.gl extension) for GPU-accelerated rendering.
 */

import type { ChannelMapping } from '../../types/viewer2D/navTypes'

/**
 * Standard H&E (Hematoxylin & Eosin) stain RGB values
 *
 * These colors are used as fallback/reference colors in the UI.
 * The actual Beer-Lambert transformation uses absorption vectors
 * defined in beerLambertStain.ts
 *
 * Hematoxylin: nucleus/chromatin (blue-purple in real H&E)
 * Eosin: cytoplasm/background (pink-red in real H&E)
 */
export const HE_STAIN_COLORS = {
  hematoxylin: [0.64, 0.08, 0.80],  // Blue-purple for nucleus
  eosin: [0.21, 0.10, 0.04],        // Pink-red for cytoplasm
  background: [1.0, 1.0, 1.0]       // White background (light color = no stain)
} as const

/**
 * Determines if both nucleus and cytoplasm channels are selected
 * This indicates the user wants H&E pseudo-color rendering
 *
 * @param channelMap - Channel mapping from roles to indices
 * @returns true if both nucleus and cytoplasm are selected
 */
export function shouldUseHEStaining(channelMap: ChannelMapping): boolean {
  return channelMap.nucleus !== null && channelMap.cytoplasm !== null
}

/**
 * Get rendering mode based on channel selection
 *
 * @param channelMap - Channel mapping from roles to indices
 * @returns 'single' if only one channel, 'dual' if both nucleus and cytoplasm
 */
export function getRenderingMode(channelMap: ChannelMapping): 'single' | 'dual' {
  const mappedChannels = Object.values(channelMap).filter(c => c !== null).length
  return mappedChannels >= 2 ? 'dual' : 'single'
}
