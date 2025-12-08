/**
 * H&E Shader Renderer for Viv Integration
 * 
 * Provides GPU-accelerated H&E stain transformation shader for use
 * within Viv's rendering pipeline. This directly applies the non-linear
 * transformation at the shader level, enabling real-time pixel-level
 * transformations before color assignment.
 * 
 * The shader implements:
 * - Non-linear H&E stain mixing via multiplicative damping model
 * - GPU-based computation for maximum performance
 * - Direct integration with Viv's layer rendering system
 */

import type { NavigationState } from '../../types/viewer2D/navState'
import type { ChannelMapping } from '../../types/viewer2D/navTypes'

/**
 * Check if both nucleus and cytoplasm channels are available for H&E staining
 */
function shouldUseHEStaining(channelMap: ChannelMapping): boolean {
  return channelMap.nucleus !== null && channelMap.cytoplasm !== null
}

/**
 * GLSL fragment shader for H&E stain transformation
 * Implements non-linear mixing directly on GPU
 */
export const heStainFragmentShader = `#version 300 es
precision highp float;

// Input channel textures (provided by Viv)
uniform sampler2D uChannel0;  // First selected channel (typically nucleus)
uniform sampler2D uChannel1;  // Second selected channel (typically cytoplasm)

// H&E color configuration
uniform vec3 uHematoxylinColor;  // Nucleus stain color
uniform vec3 uEosinColor;        // Cytoplasm stain color
uniform vec3 uBackgroundColor;   // Background (no stain)

// Non-linear transformation parameters
uniform float uDampingFactor;    // Multiplicative damping (0.6)
uniform float uPowerExponent;    // Power function exponent (0.9)
uniform float uContrastBoost;    // Contrast boost (1.2)

// Control flags
uniform bool uHeStainingEnabled;
uniform bool uHasNucleusChannel;
uniform bool uHasCytoplasmChannel;

// Texture coordinates from vertex shader
varying vec2 vTextureCoord;
varying vec3 vRayDir;

/**
 * Non-linear H&E stain transformation
 * 
 * Mathematical formulation:
 *   hematoxylin = nucleus × (1 - cytoplasm × dampingFactor)^powerExponent
 *   eosin = cytoplasm × (1 - nucleus × dampingFactor)^powerExponent
 * 
 * Creates realistic color mixing through multiplicative damping,
 * where presence of one stain reduces intensity of the other.
 */
vec4 applyHeStainTransform(float nucleusIntensity, float cytoplasmIntensity) {
  // Normalize intensities to 0-1 range
  nucleusIntensity = clamp(nucleusIntensity, 0.0, 1.0);
  cytoplasmIntensity = clamp(cytoplasmIntensity, 0.0, 1.0);
  
  // Apply non-linear transformation with power function and multiplicative damping
  float hematoxylinOutput = nucleusIntensity * pow(1.0 - cytoplasmIntensity * uDampingFactor, uPowerExponent);
  float eosinOutput = cytoplasmIntensity * pow(1.0 - nucleusIntensity * uDampingFactor, uPowerExponent);
  
  // Apply contrast boost to compensate for intensity reduction from non-linear mixing
  hematoxylinOutput *= uContrastBoost;
  eosinOutput *= uContrastBoost;
  
  // Clamp to valid range
  hematoxylinOutput = clamp(hematoxylinOutput, 0.0, 1.0);
  eosinOutput = clamp(eosinOutput, 0.0, 1.0);
  
  // Return transformed stain intensities
  return vec4(hematoxylinOutput, eosinOutput, 0.0, 1.0);
}

void main() {
  // Sample channel intensities from input textures
  float nucleusIntensity = uHasNucleusChannel ? texture(uChannel0, vTextureCoord).r : 0.0;
  float cytoplasmIntensity = uHasCytoplasmChannel ? texture(uChannel1, vTextureCoord).r : 0.0;
  
  // Apply H&E transformation
  vec4 stainTransformed = applyHeStainTransform(nucleusIntensity, cytoplasmIntensity);
  float hematoxylinIntensity = stainTransformed.r;
  float eosinIntensity = stainTransformed.g;
  
  // Blend colors based on transformed stain intensities
  vec3 finalColor = uBackgroundColor;
  
  // Apply hematoxylin color (nucleus stain)
  finalColor = mix(finalColor, uHematoxylinColor, hematoxylinIntensity);
  
  // Apply eosin color (cytoplasm stain)  
  finalColor = mix(finalColor, uEosinColor, eosinIntensity);
  
  // Output final H&E pseudo-colored pixel
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * H&E shader configuration for Viv rendering
 */
export interface HeShaderConfig {
  enabled: boolean
  nucleusChannelIndex: number | null
  cytoplasmChannelIndex: number | null
  dampingFactor?: number
  powerExponent?: number
  contrastBoost?: number
  hematoxylinColor?: [number, number, number]
  eosinColor?: [number, number, number]
  backgroundColor?: [number, number, number]
}

/**
 * Create shader uniforms for H&E rendering
 * These are passed directly to the WebGL shader program
 */
export function createHeShaderUniforms(
  navigationState: NavigationState,
  channelMap: ChannelMapping
) {
  const heEnabled = navigationState.heStainingOn && shouldUseHEStaining(channelMap)
  
  return {
    // Color uniforms
    uHematoxylinColor: [0.64, 0.08, 0.80],   // Blue-purple for nucleus
    uEosinColor: [0.21, 0.10, 0.04],         // Pink-red for cytoplasm
    uBackgroundColor: [1.0, 1.0, 1.0],       // White background
    
    // Non-linear transformation parameters
    uDampingFactor: 0.6,                      // Multiplicative damping
    uPowerExponent: 0.9,                      // Power function exponent
    uContrastBoost: 1.2,                      // Contrast boost
    
    // Control flags
    uHeStainingEnabled: heEnabled ? 1.0 : 0.0,
    uHasNucleusChannel: channelMap.nucleus !== null ? 1.0 : 0.0,
    uHasCytoplasmChannel: channelMap.cytoplasm !== null ? 1.0 : 0.0,
    
    // Channel texture bindings (will be set by layer)
    uChannel0: 0,
    uChannel1: 1,
  }
}

/**
 * Vertex shader for H&E rendering
 * Simple pass-through, texture coordinates are provided by Viv
 */
export const heStainVertexShader = `
attribute vec3 positions;
attribute vec2 texCoords;

uniform mat4 uMVPMatrix;

varying vec2 vTextureCoord;
varying vec3 vRayDir;

void main() {
  gl_Position = uMVPMatrix * vec4(positions, 1.0);
  vTextureCoord = texCoords;
  vRayDir = normalize(positions);
}
`;

/**
 * Applies H&E shader parameters to a Viv layer
 * Call this on layer props before passing to VivViewer
 */
export function applyHeStainShaderToLayer(
  layerProps: any,
  navigationState: NavigationState,
  channelMap: ChannelMapping
) {
  if (!navigationState.heStainingOn || !shouldUseHEStaining(channelMap)) {
    return layerProps
  }
  
  // Add shader module configuration to layer props
  return {
    ...layerProps,
    // Custom shader module for H&E rendering
    shaderModule: heStainShaderModule,
    // Shader uniforms
    shaderUniforms: createHeShaderUniforms(navigationState, channelMap),
    // Enable custom shader
    useCustomShader: true,
  }
}

/**
 * Shader module object compatible with deck.gl
 * Contains vertex and fragment shaders for H&E rendering
 */
export const heStainShaderModule = {
  name: 'heStainShader',
  vs: heStainVertexShader,
  fs: heStainFragmentShader,
  getUniforms: (opts: any) => createHeShaderUniforms(opts.navigationState, opts.channelMap),
}

/**
 * Type definition for shader-enabled layer
 */
export interface ShaderEnabledLayerProps {
  shaderModule?: typeof heStainShaderModule
  shaderUniforms?: ReturnType<typeof createHeShaderUniforms>
  useCustomShader?: boolean
}
