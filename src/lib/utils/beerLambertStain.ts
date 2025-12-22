/**
 * Beer-Lambert H&E Stain Separation
 *
 * Implements physically accurate H&E pseudo-staining using Beer-Lambert law
 * with absorption vectors optimized for fluorescence microscopy.
 *
 * Based on the approach from genHnE.py which successfully generates H&E-like
 * images from dual-channel (DAPI + autofluorescence) confocal data.
 *
 * Formula: RGB[i] = 255 × exp(-(OD_hematoxylin + OD_eosin))
 * where OD = stain_vector[i] × weight × intensity / max_intensity
 */

/**
 * H&E Stain Absorption Vectors
 *
 * These vectors represent the absorption characteristics of each stain
 * in RGB color space, optimized for fluorescence-to-H&E conversion.
 *
 * From genHnE.py reference implementation:
 * - Hematoxylin (nuclear stain, from DAPI): [0.17, 0.27, 0.105]
 * - Eosin (cytoplasmic stain, from autofluorescence): [0.05, 1.0, 0.54]
 */
export const STAIN_ABSORPTION_VECTORS = {
  /**
   * Hematoxylin (nuclear stain, from DAPI channel)
   * Produces blue-purple color
   */
  hematoxylin: {
    r: 0.17,
    g: 0.27,
    b: 0.105
  },

  /**
   * Eosin (cytoplasmic stain, from autofluorescence channel)
   * Produces pink-red color
   */
  eosin: {
    r: 0.05,
    g: 1.0,
    b: 0.54
  }
} as const

/**
 * Configuration for Beer-Lambert H&E staining
 */
export interface BeerLambertConfig {
  /** Hematoxylin color weight/density (0.5-5.0, default 2.56) */
  hematoxylinWeight: number

  /** Eosin color weight/density (0.01-1.0, default 0.1) */
  eosinWeight: number

  /** Maximum intensity value for normalization (default 65535 for uint16) */
  maxIntensity: number

  /** Enable Beer-Lambert transformation */
  enabled: boolean
}

/**
 * Default configuration for H&E staining
 */
export const DEFAULT_BEER_LAMBERT_CONFIG: BeerLambertConfig = {
  hematoxylinWeight: 2.56,  // Hematoxylin (nuclear) stain weight
  eosinWeight: 0.1,         // Eosin (cytoplasmic) stain weight
  maxIntensity: 65535,      // uint16 max (will be adjusted based on actual data range)
  enabled: true
}

/**
 * Apply Beer-Lambert staining to generate H&E appearance
 *
 * This function takes fluorescence intensities from nucleus and cytoplasm channels
 * and converts them to H&E-like RGB appearance using Beer-Lambert law.
 *
 * Algorithm (from genHnE.py):
 * 1. For each RGB channel i:
 *    - od_hematoxylin = stain_H[i] × weight_H × intensity_nucleus / max_intensity
 *    - od_eosin = stain_E[i] × weight_E × intensity_cytoplasm / max_intensity
 *    - RGB[i] = 255 × exp(-od_hematoxylin) × exp(-od_eosin)
 *
 * Note: Fluorescence intensities should be contrast-adjusted BEFORE calling this function
 *
 * @param nucleusIntensity Nucleus channel intensity (after contrast adjustment)
 * @param cytoplasmIntensity Cytoplasm channel intensity (after contrast adjustment)
 * @param config Beer-Lambert configuration
 * @returns RGB color [r, g, b] in range [0, 255]
 */
export function applyBeerLambertStaining(
  nucleusIntensity: number,
  cytoplasmIntensity: number,
  config: BeerLambertConfig = DEFAULT_BEER_LAMBERT_CONFIG
): [number, number, number] {
  const maxGray = config.maxIntensity

  // Compute optical density for each RGB channel
  // OD = stain_vector × weight × intensity / max_intensity
  const od_H_r = STAIN_ABSORPTION_VECTORS.hematoxylin.r * config.hematoxylinWeight * nucleusIntensity / maxGray
  const od_H_g = STAIN_ABSORPTION_VECTORS.hematoxylin.g * config.hematoxylinWeight * nucleusIntensity / maxGray
  const od_H_b = STAIN_ABSORPTION_VECTORS.hematoxylin.b * config.hematoxylinWeight * nucleusIntensity / maxGray

  const od_E_r = STAIN_ABSORPTION_VECTORS.eosin.r * config.eosinWeight * cytoplasmIntensity / maxGray
  const od_E_g = STAIN_ABSORPTION_VECTORS.eosin.g * config.eosinWeight * cytoplasmIntensity / maxGray
  const od_E_b = STAIN_ABSORPTION_VECTORS.eosin.b * config.eosinWeight * cytoplasmIntensity / maxGray

  // Apply Beer-Lambert law: I = I₀ × exp(-OD_total)
  // Using natural exponential (e), not base-10
  const r = 255 * Math.exp(-od_H_r) * Math.exp(-od_E_r)
  const g = 255 * Math.exp(-od_H_g) * Math.exp(-od_E_g)
  const b = 255 * Math.exp(-od_H_b) * Math.exp(-od_E_b)

  // Clamp to valid RGB range [0, 255]
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b))
  ]
}

/**
 * Validate Beer-Lambert configuration
 *
 * @param config Configuration to validate
 * @returns true if valid, false otherwise
 */
export function validateBeerLambertConfig(config: BeerLambertConfig): boolean {
  if (config.hematoxylinWeight < 0.5 || config.hematoxylinWeight > 20.0) {
    console.warn(`Hematoxylin weight ${config.hematoxylinWeight} out of range [0.5, 20.0]`)
    return false
  }

  if (config.eosinWeight < 0.01 || config.eosinWeight > 5.0) {
    console.warn(`Eosin weight ${config.eosinWeight} out of range [0.01, 5.0]`)
    return false
  }

  if (config.maxIntensity <= 0) {
    console.warn(`Max intensity ${config.maxIntensity} must be positive`)
    return false
  }

  return true
}

/**
 * Create lookup table for fast Beer-Lambert transformation
 *
 * Pre-computes transformations for all possible intensity combinations.
 * Useful for CPU-based batch processing or validation.
 *
 * @param resolution Number of steps per channel (e.g., 256 for 8-bit)
 * @param config Beer-Lambert configuration
 * @returns 2D lookup table: lut[nucleus][cytoplasm] = [r, g, b]
 */
export function createBeerLambertLUT(
  resolution: number = 256,
  config: BeerLambertConfig = DEFAULT_BEER_LAMBERT_CONFIG
): Array<Array<[number, number, number]>> {
  const lut: Array<Array<[number, number, number]>> = []

  // Scale intensities based on resolution
  const scale = config.maxIntensity / (resolution - 1)

  for (let n = 0; n < resolution; n++) {
    const row: Array<[number, number, number]> = []
    for (let c = 0; c < resolution; c++) {
      const nucleusIntensity = n * scale
      const cytoplasmIntensity = c * scale
      const rgb = applyBeerLambertStaining(nucleusIntensity, cytoplasmIntensity, config)
      row.push(rgb)
    }
    lut.push(row)
  }

  return lut
}

/**
 * Get stain absorption vectors as flat arrays for shader uniforms
 *
 * @returns Object with hematoxylin and eosin vectors as [r, g, b] arrays
 */
export function getStainVectorsForShader(): {
  hematoxylin: [number, number, number]
  eosin: [number, number, number]
} {
  return {
    hematoxylin: [
      STAIN_ABSORPTION_VECTORS.hematoxylin.r,
      STAIN_ABSORPTION_VECTORS.hematoxylin.g,
      STAIN_ABSORPTION_VECTORS.hematoxylin.b
    ],
    eosin: [
      STAIN_ABSORPTION_VECTORS.eosin.r,
      STAIN_ABSORPTION_VECTORS.eosin.g,
      STAIN_ABSORPTION_VECTORS.eosin.b
    ]
  }
}

/**
 * Convert normalized intensity (0-1) to optical density for a single channel
 *
 * @param intensity Normalized intensity (0-1)
 * @param stainVector Stain absorption vector [r, g, b]
 * @param weight Color weight/density
 * @returns Optical density for each RGB channel [od_r, od_g, od_b]
 */
export function intensityToOpticalDensity(
  intensity: number,
  stainVector: [number, number, number],
  weight: number
): [number, number, number] {
  return [
    stainVector[0] * weight * intensity,
    stainVector[1] * weight * intensity,
    stainVector[2] * weight * intensity
  ]
}

/**
 * Convert combined optical densities back to RGB using Beer-Lambert law
 *
 * @param od_total Total optical density [od_r, od_g, od_b]
 * @returns RGB color [r, g, b] in range [0, 255]
 */
export function opticalDensityToRgb(
  od_total: [number, number, number]
): [number, number, number] {
  return [
    Math.max(0, Math.min(255, 255 * Math.exp(-od_total[0]))),
    Math.max(0, Math.min(255, 255 * Math.exp(-od_total[1]))),
    Math.max(0, Math.min(255, 255 * Math.exp(-od_total[2])))
  ]
}
