import * as zarrita from 'zarrita'

import type { 
  OMEAxes, 
  OMEMultiscales, 
  OMEROMetadata, 
  ProcessedOMEMetadata,
  OMEdataset,
  OMEPlate,
  OMEWell,
  OMEImageLabel
} from '../../types/metadata/ome'


/**
 * Utility functions for processing OME-Zarr metadata and data
 */

// Type guards for OME-Zarr attributes
export function isOmePlate(attrs: any): attrs is { plate: OMEPlate } {
  return attrs && typeof attrs === 'object' && 'plate' in attrs
}

export function isOmeWell(attrs: any): attrs is { well: OMEWell } {
  return attrs && typeof attrs === 'object' && 'well' in attrs
}

export function isOmeMultiscales(attrs: any): attrs is { 
  multiscales: OMEMultiscales[], 
  omero?: OMEROMetadata 
} {
  return attrs && typeof attrs === 'object' && 'multiscales' in attrs
    && Array.isArray(attrs.multiscales)
}

export function isOmeImageLabel(attrs: any): attrs is {
  'image-label': OMEImageLabel,
  multiscales: OMEMultiscales[]
} {
  return attrs && typeof attrs === 'object'
    && 'image-label' in attrs && 'multiscales' in attrs
}

/**
 * Determine the type of OME-Zarr structure from attributes
 */
export function getOmeZarrType(attrs: any): 'plate' | 'well' | 'multiscales' | 'image-label' | 'unknown' {
  if (isOmePlate(attrs)) return 'plate'
  if (isOmeWell(attrs)) return 'well'
  if (isOmeImageLabel(attrs)) return 'image-label'
  if (isOmeMultiscales(attrs)) return 'multiscales'
  return 'unknown'
}

/**
 * Check if OME-Zarr structure contains valid multiscale data
 */
export function hasValidMultiscales(attrs: any): boolean {
  if (!isOmeMultiscales(attrs)) return false
  
  const multiscales = attrs.multiscales
  if (!Array.isArray(multiscales) || multiscales.length === 0) return false
  
  const firstMultiscale = multiscales[0]
  return (
    firstMultiscale &&
    Array.isArray(firstMultiscale.datasets) &&
    firstMultiscale.datasets.length > 0 &&
    Array.isArray(firstMultiscale.axes) &&
    firstMultiscale.axes.length > 0
  )
}

// Load multiscale arrays from a zarr group
export async function loadMultiscales(
  grp: zarrita.Group<zarrita.Readable>, 
  multiscales: OMEMultiscales[]
): Promise<zarrita.Array<any, zarrita.Readable>[]> {
  const multiscale = multiscales[0] // Use first multiscale
  const datasets = multiscale.datasets
  
  const arrays = await Promise.all(
    datasets.map(async (dataset: OMEdataset) => {
      const arr = await zarrita.open(grp.resolve(dataset.path))
      if (!(arr instanceof zarrita.Array)) {
        throw new Error(`Expected Array at ${dataset.path}, got ${arr.kind}`)
      }
      return arr
    })
  )
  
  return arrays
}

// Extract axis information from OME-Zarr multiscales
export function getNgffAxes(multiscales: OMEMultiscales[]): OMEAxes[] {
  const multiscale = multiscales[0]
  return multiscale.axes || []
}

// Generate axis labels for data indexing
export function getNgffAxisAttributes(axes: OMEAxes[]): string[] {
  return axes.map(axis => axis.name)
}

// Parse OMERO metadata for visualization
export function parseOmeroMeta(omero: OMEROMetadata | undefined, axes: OMEAxes[]): ProcessedOMEMetadata {
  const axis_labels = getNgffAxisAttributes(axes)
  
  // Default selection (start at 0 for all dimensions)
  const defaultSelection: Record<string, number> = {}
  axis_labels.forEach(label => {
    defaultSelection[label] = 0
  })
  
  // Set up domains (dimension ranges)
  const domains: Record<string, number[]> = {}
  
  // Default channels setup
  const channels = []
  
  if (omero?.channels) {
    // Process OMERO channel information
    for (const [i, channel] of omero.channels.entries()) {
      const color = parseColorString(channel.color) || [255, 255, 255] as [number, number, number]
      const window = channel.window ? [channel.window.start, channel.window.end] as [number, number] : [0, 255] as [number, number]
      
      channels.push({
        color,
        window,
        label: channel.label || `Channel ${i}`,
        visible: channel.active !== false
      })
    }
  } else {
    // Default single channel if no OMERO metadata
    channels.push({
      color: [255, 255, 255] as [number, number, number],
      window: [0, 255] as [number, number],
      label: 'Channel 0',
      visible: true
    })
  }
  
  return {
    name: omero?.name,
    defaultSelection,
    domains,
    channels,
    axis_labels,
    axes
  }
}

// Parse color string (e.g., "FF0000" -> [255, 0, 0])
function parseColorString(colorStr?: string): [number, number, number] | null {
  if (!colorStr) return null
  
  // Remove # if present
  const hex = colorStr.replace('#', '')
  
  if (hex.length === 6) {
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    return [r, g, b]
  }
  
  return null
}

// Convert coordinate transformations to model matrix
export function coordinateTransformationsToMatrix(multiscales: OMEMultiscales[]): number[][] {
  const multiscale = multiscales[0]
  const transforms = multiscale.coordinateTransformations || []
  
  // Start with identity matrix
  let matrix = createIdentityMatrix(4)
  
  for (const transform of transforms) {
    if (transform.type === 'scale' && transform.scale) {
      matrix = multiplyMatrices(matrix, createScaleMatrix(transform.scale))
    } else if (transform.type === 'translation' && transform.translation) {
      matrix = multiplyMatrices(matrix, createTranslationMatrix(transform.translation))
    }
  }
  
  return matrix
}

// Matrix utility functions
function createIdentityMatrix(size: number): number[][] {
  const matrix = Array(size).fill(null).map(() => Array(size).fill(0))
  for (let i = 0; i < size; i++) {
    matrix[i][i] = 1
  }
  return matrix
}

function createScaleMatrix(scale: number[]): number[][] {
  const matrix = createIdentityMatrix(4)
  for (let i = 0; i < Math.min(scale.length, 3); i++) {
    matrix[i][i] = scale[i]
  }
  return matrix
}

function createTranslationMatrix(translation: number[]): number[][] {
  const matrix = createIdentityMatrix(4)
  for (let i = 0; i < Math.min(translation.length, 3); i++) {
    matrix[i][3] = translation[i]
  }
  return matrix
}

function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const result = Array(a.length).fill(null).map(() => Array(b[0].length).fill(0))
  
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b[0].length; j++) {
      for (let k = 0; k < b.length; k++) {
        result[i][j] += a[i][k] * b[k][j]
      }
    }
  }
  
  return result
}

// Parse matrix from string representation
export function parseMatrix(matrixStr: number[][]): number[][] {
  return matrixStr // Already in correct format
}

// Guess appropriate tile size for efficient loading
export function guessTileSize(arr: zarrita.Array<any, zarrita.Readable>): number {
  const chunks = arr.chunks
  if (chunks.length >= 2) {
    // Use the minimum of the last two dimensions (usually Y, X)
    return Math.min(chunks[chunks.length - 1], chunks[chunks.length - 2])
  }
  return 256 // Default tile size
}

// Open zarr store from URL
export async function open(source: string): Promise<zarrita.Group<zarrita.Readable> | zarrita.Array<any, zarrita.Readable>> {
  const store = new zarrita.FetchStore(source)
  return await zarrita.open(store, { kind: 'group' })
}
