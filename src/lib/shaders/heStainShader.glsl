/**
 * H&E Stain Non-Linear Transformation Shader
 * 
 * Implements pixel-level non-linear H&E pseudo-color rendering
 * directly in GPU using GLSL fragment shader.
 * 
 * Applied to channel data before color assignment in Viv rendering pipeline.
 * Transforms nucleus and cytoplasm intensities into H&E stain appearance.
 */

#version 100
precision highp float;

// Input texture samplers for nucleus and cytoplasm channels
uniform sampler2D uNucleusChannel;
uniform sampler2D uCytoplasmChannel;

// H&E color constants (normalized to 0-1)
uniform vec3 uHematoxylinColor;  // Blue-purple [0.64, 0.08, 0.80]
uniform vec3 uEosinColor;        // Pink-red [0.21, 0.10, 0.04]
uniform vec3 uBackgroundColor;   // White [1.0, 1.0, 1.0]

// Non-linear transformation parameters
uniform float uDampingFactor;    // Multiplicative damping (default: 0.6)
uniform float uPowerExponent;    // Power function exponent (default: 0.9)
uniform float uContrastBoost;    // Contrast boost factor (default: 1.2)

// Enable/disable H&E staining
uniform bool uHeStainingEnabled;
uniform bool uHasNucleusChannel;
uniform bool uHasCytoplasmChannel;

varying vec2 vTextureCoord;

/**
 * Non-linear H&E stain transformation
 * 
 * Formulas:
 *   hematoxylin = nucleusStain × pow(1 - cytoplasmStain × dampingFactor, powerExponent)
 *   eosin = cytoplasmStain × pow(1 - nucleusStain × dampingFactor, powerExponent)
 * 
 * This creates realistic H&E appearance through multiplicative damping:
 * - High nucleus, low cytoplasm → Strong hematoxylin (blue-purple)
 * - High cytoplasm, low nucleus → Strong eosin (pink-red)
 * - Both high → Mixed mauve/gray-purple tones
 */
vec4 computeHEStainTransform(float nucleusStain, float cytoplasmStain) {
  // Apply non-linear transformation with power function and multiplicative damping
  float hematoxylinIntensity = nucleusStain * pow(1.0 - cytoplasmStain * uDampingFactor, uPowerExponent);
  float eosinIntensity = cytoplasmStain * pow(1.0 - nucleusStain * uDampingFactor, uPowerExponent);
  
  // Apply contrast boost to compensate for intensity reduction from non-linear mixing
  hematoxylinIntensity *= uContrastBoost;
  eosinIntensity *= uContrastBoost;
  
  // Clamp to valid range
  hematoxylinIntensity = clamp(hematoxylinIntensity, 0.0, 1.0);
  eosinIntensity = clamp(eosinIntensity, 0.0, 1.0);
  
  // Return transformed intensities as RGBA
  // R channel: hematoxylin intensity
  // G channel: eosin intensity
  // B channel: unused
  // A channel: 1.0 (full opacity)
  return vec4(hematoxylinIntensity, eosinIntensity, 0.0, 1.0);
}

/**
 * Simple linear stain blending (for reference)
 * Used for comparison or fallback rendering
 */
vec4 computeLinearStainBlend(float nucleusStain, float cytoplasmStain) {
  // Linear interpolation between stains
  float hematoxylinIntensity = nucleusStain;
  float eosinIntensity = cytoplasmStain;
  
  return vec4(hematoxylinIntensity, eosinIntensity, 0.0, 1.0);
}

/**
 * Main fragment shader program
 * Samples nucleus and cytoplasm channels and applies H&E transformation
 */
void main() {
  // Get normalized stain intensities from input channels (0-1 range)
  float nucleusIntensity = uHasNucleusChannel ? 
    texture2D(uNucleusChannel, vTextureCoord).r : 0.0;
  float cytoplasmIntensity = uHasCytoplasmChannel ? 
    texture2D(uCytoplasmChannel, vTextureCoord).r : 0.0;
  
  vec4 stainTransformed;
  
  if (uHeStainingEnabled && uHasNucleusChannel && uHasCytoplasmChannel) {
    // Apply non-linear H&E transformation
    stainTransformed = computeHEStainTransform(nucleusIntensity, cytoplasmIntensity);
  } else {
    // Fallback to linear blending
    stainTransformed = computeLinearStainBlend(nucleusIntensity, cytoplasmIntensity);
  }
  
  // Extract transformed intensities
  float hematoxylinIntensity = stainTransformed.r;
  float eosinIntensity = stainTransformed.g;
  
  // Blend colors based on stain intensities
  // Start with background color (no stain)
  vec3 finalColor = uBackgroundColor;
  
  // Apply hematoxylin (nucleus stain)
  finalColor = mix(finalColor, uHematoxylinColor, hematoxylinIntensity);
  
  // Apply eosin (cytoplasm stain)
  finalColor = mix(finalColor, uEosinColor, eosinIntensity);
  
  // Output final H&E colored pixel
  gl_FragColor = vec4(finalColor, 1.0);
}
