/**
 * H&E Stain Extension for deck.gl
 *
 * Custom deck.gl LayerExtension that applies Beer-Lambert H&E pseudo-staining
 * to dual-channel fluorescence data in real-time on the GPU.
 *
 * This extension replaces the default ColorPaletteExtension used by Viv
 * with a physically accurate Beer-Lambert transformation.
 */

import { LayerExtension } from '@deck.gl/core'
import type { Layer, UpdateParameters, DefaultProps } from '@deck.gl/core'
import { STAIN_ABSORPTION_VECTORS, DEFAULT_BEER_LAMBERT_CONFIG } from '../utils/beerLambertStain'

/**
 * H&E Stain Extension Configuration
 */
export interface HEStainExtensionProps {
  /** Hematoxylin color weight (0.5-5.0, default 2.56) */
  heStainHematoxylinWeight?: number

  /** Eosin color weight (0.01-1.0, default 0.1) */
  heStainEosinWeight?: number

  /** Maximum intensity for normalization (default 65535) */
  heStainMaxIntensity?: number

  /** Enable H&E staining (default true) */
  heStainEnabled?: boolean
}

const defaultProps: DefaultProps<HEStainExtensionProps> = {
  heStainHematoxylinWeight: DEFAULT_BEER_LAMBERT_CONFIG.hematoxylinWeight,
  heStainEosinWeight: DEFAULT_BEER_LAMBERT_CONFIG.eosinWeight,
  heStainMaxIntensity: DEFAULT_BEER_LAMBERT_CONFIG.maxIntensity,
  heStainEnabled: true
}

/**
 * GLSL Fragment Shader for Beer-Lambert H&E Staining
 *
 * Implements the formula from genHnE.py:
 * For each RGB channel i:
 *   od_H = stain_H[i] × weight_H × intensity_nucleus / max_intensity
 *   od_E = stain_E[i] × weight_E × intensity_cytoplasm / max_intensity
 *   RGB[i] = 255 × exp(-od_H) × exp(-od_E)
 */
const fs = `
#ifdef GL_ES
precision highp float;
#endif

// Stain absorption vectors (from genHnE.py)
uniform vec3 heStainHematoxylinVector;
uniform vec3 heStainEosinVector;

// Color weights (tunable parameters)
uniform float heStainHematoxylinWeight;
uniform float heStainEosinWeight;

// Maximum intensity for normalization
uniform float heStainMaxIntensity;

// Enable/disable flag
uniform bool heStainEnabled;

vec3 applyHEStaining(float intensity0, float intensity1) {
  // Note: intensity0 and intensity1 are already normalized [0, 1] by Viv's contrast limits

  // Compute optical density for each RGB channel
  // OD = stain_vector × weight × normalized_intensity
  vec3 od_hematoxylin = heStainHematoxylinVector * heStainHematoxylinWeight * intensity0;
  vec3 od_eosin = heStainEosinVector * heStainEosinWeight * intensity1;

  // Apply Beer-Lambert law: RGB = exp(-(od_H + od_E))
  // Result is already in [0, 1] range
  vec3 rgb = exp(-(od_hematoxylin + od_eosin));

  return rgb;
}
`

const inject = {
  'fs:DECKGL_MUTATE_COLOR': `
    if (heStainEnabled) {
      // Apply H&E staining to first two channels (nucleus and cytoplasm)
      vec3 heColor = applyHEStaining(intensity0, intensity1);
      rgba.rgb = heColor;
    }
    // If heStainEnabled is false, ColorPaletteExtension handles the rendering
  `
}

/**
 * HEStainExtension class
 *
 * Extends deck.gl LayerExtension to inject H&E staining shader code
 * into Viv's MultiscaleImageLayer rendering pipeline.
 */
export class HEStainExtension extends LayerExtension {
  static extensionName = 'HEStainExtension'
  static defaultProps = defaultProps

  constructor() {
    super()
    console.log('🎨 HEStainExtension initialized')
  }

  /**
   * Get shader modules and injection points
   */
  getShaders(): any {
    console.log('🎨 HEStainExtension getShaders() called')

    return {
      modules: [
        {
          name: 'he-stain',
          fs,
          inject
        }
      ]
    }
  }

  /**
   * Draw hook - set uniforms before rendering
   */
  draw(this: any, params: any): void {
    const { uniforms } = params
    const props = this.props

    // Get stain vectors (these are constant)
    const hematoxylinVector = [
      STAIN_ABSORPTION_VECTORS.hematoxylin.r,
      STAIN_ABSORPTION_VECTORS.hematoxylin.g,
      STAIN_ABSORPTION_VECTORS.hematoxylin.b
    ]

    const eosinVector = [
      STAIN_ABSORPTION_VECTORS.eosin.r,
      STAIN_ABSORPTION_VECTORS.eosin.g,
      STAIN_ABSORPTION_VECTORS.eosin.b
    ]

    // Set uniforms from layer props
    const heUniforms = {
      heStainHematoxylinVector: hematoxylinVector,
      heStainEosinVector: eosinVector,
      heStainHematoxylinWeight: props.heStainHematoxylinWeight ?? DEFAULT_BEER_LAMBERT_CONFIG.hematoxylinWeight,
      heStainEosinWeight: props.heStainEosinWeight ?? DEFAULT_BEER_LAMBERT_CONFIG.eosinWeight,
      heStainMaxIntensity: props.heStainMaxIntensity ?? DEFAULT_BEER_LAMBERT_CONFIG.maxIntensity,
      heStainEnabled: props.heStainEnabled ?? true
    }

    // Merge with existing uniforms
    Object.assign(uniforms, heUniforms)

    console.log('🎨 HEStainExtension draw() setting uniforms:', heUniforms)
  }
}

/**
 * Create H&E stain extension
 *
 * Note: Configuration is passed through layer props, not extension props
 * @returns HEStainExtension instance
 */
export function createHEStainExtension(): HEStainExtension {
  return new HEStainExtension()
}
