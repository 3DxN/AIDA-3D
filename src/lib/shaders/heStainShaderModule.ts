/**
 * H&E Stain Shader Module
 * 
 * Provides GPU-accelerated non-linear H&E pseudo-color rendering
 * using GLSL shaders compatible with deck.gl and Viv rendering pipeline.
 * 
 * Applies non-linear transformation to channel data before color assignment,
 * enabling real-time H&E pseudo-color visualization on the GPU.
 */

/**
 * H&E stain transformation shader module for deck.gl
 * 
 * Applies non-linear mixing of nucleus and cytoplasm channels
 * to create authentic H&E pseudo-color appearance.
 */
export const heStainShaderModule = {
  name: 'heStain',
  
  // Vertex shader remains unchanged - just pass through texture coordinates
  vs: `#version 300 es
    in vec3 positions;
    in vec2 texCoords;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    
    out vec2 vTextureCoord;
    
    void main() {
      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(positions, 1.0);
      vTextureCoord = texCoords;
    }
  `,
  
  // Fragment shader with H&E transformation
  fs: `#version 300 es
    precision highp float;
    
    // Input textures
    uniform sampler2D uNucleusTexture;
    uniform sampler2D uCytoplasmTexture;
    
    // H&E color constants (normalized to 0-1)
    uniform vec3 uHematoxylinColor;  // Blue-purple
    uniform vec3 uEosinColor;        // Pink-red
    uniform vec3 uBackgroundColor;   // White background
    
    // Non-linear transformation parameters
    uniform float uDampingFactor;    // Multiplicative damping (0.6)
    uniform float uPowerExponent;    // Power exponent (0.9)
    uniform float uContrastBoost;    // Contrast boost (1.2)
    
    // Control flags
    uniform bool uHeStainingEnabled;
    uniform bool uHasNucleusChannel;
    uniform bool uHasCytoplasmChannel;
    
    in vec2 vTextureCoord;
    out vec4 fragColor;
    
    /**
     * Non-linear H&E stain transformation
     * Implements the core mathematical model for H&E pseudo-coloring
     */
    void computeHEStainTransform(
      float nucleusStain,
      float cytoplasmStain,
      out float hematoxylinIntensity,
      out float eosinIntensity
    ) {
      // Apply non-linear transformation with power function and multiplicative damping
      hematoxylinIntensity = nucleusStain * pow(1.0 - cytoplasmStain * uDampingFactor, uPowerExponent);
      eosinIntensity = cytoplasmStain * pow(1.0 - nucleusStain * uDampingFactor, uPowerExponent);
      
      // Apply contrast boost to compensate for intensity reduction
      hematoxylinIntensity *= uContrastBoost;
      eosinIntensity *= uContrastBoost;
      
      // Clamp to valid range
      hematoxylinIntensity = clamp(hematoxylinIntensity, 0.0, 1.0);
      eosinIntensity = clamp(eosinIntensity, 0.0, 1.0);
    }
    
    void main() {
      // Sample channel intensities from input textures
      float nucleusIntensity = uHasNucleusChannel ? 
        texture(uNucleusTexture, vTextureCoord).r : 0.0;
      float cytoplasmIntensity = uHasCytoplasmChannel ? 
        texture(uCytoplasmTexture, vTextureCoord).r : 0.0;
      
      float hematoxylinIntensity;
      float eosinIntensity;
      
      if (uHeStainingEnabled && uHasNucleusChannel && uHasCytoplasmChannel) {
        // Apply non-linear H&E transformation
        computeHEStainTransform(nucleusIntensity, cytoplasmIntensity, hematoxylinIntensity, eosinIntensity);
      } else {
        // Fallback: linear passthrough
        hematoxylinIntensity = nucleusIntensity;
        eosinIntensity = cytoplasmIntensity;
      }
      
      // Blend colors based on transformed stain intensities
      vec3 finalColor = uBackgroundColor;
      
      // Apply hematoxylin (nucleus stain) color
      finalColor = mix(finalColor, uHematoxylinColor, hematoxylinIntensity);
      
      // Apply eosin (cytoplasm stain) color
      finalColor = mix(finalColor, uEosinColor, eosinIntensity);
      
      // Output final H&E colored pixel
      fragColor = vec4(finalColor, 1.0);
    }
  `,
  
  // Uniform types and default values
  uniformTypes: {
    uNucleusTexture: 'i32',
    uCytoplasmTexture: 'i32',
    uHematoxylinColor: 'vec3',
    uEosinColor: 'vec3',
    uBackgroundColor: 'vec3',
    uDampingFactor: 'f32',
    uPowerExponent: 'f32',
    uContrastBoost: 'f32',
    uHeStainingEnabled: 'i32',
    uHasNucleusChannel: 'i32',
    uHasCytoplasmChannel: 'i32',
  },
  
  // Default uniform values matching heStainTransform.ts
  getUniforms: () => ({
    uHematoxylinColor: [0.64, 0.08, 0.80],  // Blue-purple
    uEosinColor: [0.21, 0.10, 0.04],        // Pink-red
    uBackgroundColor: [1.0, 1.0, 1.0],      // White
    uDampingFactor: 0.6,                     // Multiplicative damping
    uPowerExponent: 0.9,                     // Power function exponent
    uContrastBoost: 1.2,                     // Contrast boost
    uHeStainingEnabled: 1,
    uHasNucleusChannel: 1,
    uHasCytoplasmChannel: 1,
  }),
};

/**
 * Configuration object for H&E shader rendering
 */
export interface HeStainShaderConfig {
  /** Enable non-linear H&E staining */
  enabled: boolean;
  
  /** Whether nucleus channel is available */
  hasNucleusChannel: boolean;
  
  /** Whether cytoplasm channel is available */
  hasCytoplasmChannel: boolean;
  
  /** Multiplicative damping factor (0.3-0.8, default 0.6) */
  dampingFactor?: number;
  
  /** Power function exponent (0.7-1.1, default 0.9) */
  powerExponent?: number;
  
  /** Contrast boost factor (1.0-1.5, default 1.2) */
  contrastBoost?: number;
  
  /** Hematoxylin color RGB (normalized to 0-1) */
  hematoxylinColor?: [number, number, number];
  
  /** Eosin color RGB (normalized to 0-1) */
  eosinColor?: [number, number, number];
  
  /** Background color RGB (normalized to 0-1) */
  backgroundColor?: [number, number, number];
}

/**
 * Default H&E shader configuration
 * Matches mathematical constants from heStainTransform.ts
 */
export const defaultHeStainConfig: Required<HeStainShaderConfig> = {
  enabled: true,
  hasNucleusChannel: true,
  hasCytoplasmChannel: true,
  dampingFactor: 0.6,
  powerExponent: 0.9,
  contrastBoost: 1.2,
  hematoxylinColor: [0.64, 0.08, 0.80],  // Blue-purple
  eosinColor: [0.21, 0.10, 0.04],        // Pink-red
  backgroundColor: [1.0, 1.0, 1.0],      // White
};

/**
 * Create shader uniforms from H&E configuration
 * @param config - H&E shader configuration
 * @returns Uniforms object for deck.gl layer
 */
export function createHeStainUniforms(config: HeStainShaderConfig) {
  const finalConfig = { ...defaultHeStainConfig, ...config };
  
  return {
    uHematoxylinColor: finalConfig.hematoxylinColor,
    uEosinColor: finalConfig.eosinColor,
    uBackgroundColor: finalConfig.backgroundColor,
    uDampingFactor: finalConfig.dampingFactor,
    uPowerExponent: finalConfig.powerExponent,
    uContrastBoost: finalConfig.contrastBoost,
    uHeStainingEnabled: finalConfig.enabled ? 1 : 0,
    uHasNucleusChannel: finalConfig.hasNucleusChannel ? 1 : 0,
    uHasCytoplasmChannel: finalConfig.hasCytoplasmChannel ? 1 : 0,
  };
}

/**
 * Validates shader configuration parameters
 * Ensures all values are within acceptable ranges
 */
export function validateHeStainConfig(config: HeStainShaderConfig): boolean {
  if (config.dampingFactor !== undefined) {
    if (config.dampingFactor < 0.3 || config.dampingFactor > 0.8) {
      console.warn('Damping factor should be between 0.3 and 0.8');
      return false;
    }
  }
  
  if (config.powerExponent !== undefined) {
    if (config.powerExponent < 0.7 || config.powerExponent > 1.1) {
      console.warn('Power exponent should be between 0.7 and 1.1');
      return false;
    }
  }
  
  if (config.contrastBoost !== undefined) {
    if (config.contrastBoost < 1.0 || config.contrastBoost > 1.5) {
      console.warn('Contrast boost should be between 1.0 and 1.5');
      return false;
    }
  }
  
  return true;
}
