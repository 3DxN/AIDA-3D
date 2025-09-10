/**
 * Comprehensive OME metadata types for OME-Zarr support
 * Based on OME-NGFF specification v0.4 and v0.5
 */

export interface IStringAny {
  [key: string]: any
}

// Core OME-Zarr types
export interface OMEAxes extends IStringAny {
  name: string;
  type: 'time' | 'channel' | 'space' | string;
  unit?: string;
}

export interface OMECoordinateTransformation extends IStringAny {
  type: 'identity' | 'translation' | 'scale' | string;
  scale?: number[];
  translation?: number[];
}

export interface OMEdataset extends IStringAny {
  path: string;
  coordinateTransformations: OMECoordinateTransformation[];
}

export interface OMEMultiscales extends IStringAny {
  version?: string;
  name?: string;
  axes: OMEAxes[];
  datasets: OMEdataset[];
  coordinateTransformations?: OMECoordinateTransformation[];
  type?: string;
  metadata?: Record<string, any>;
}

// OMERO metadata
export interface OMEROChannel {
  window?: {
    start: number;
    end: number;
    min?: number;
    max?: number;
  };
  label?: string;
  family?: string;
  color?: string;
  active?: boolean;
  coefficient?: number;
  inverted?: boolean;
}

export interface OMERORdefs {
  defaultZ?: number;
  defaultT?: number;
  model?: 'greyscale' | 'color';
}

export interface OMEROMetadata {
  id?: number;
  name?: string;
  version?: string;
  channels?: OMEROChannel[];
  rdefs?: OMERORdefs;
}

// Plate and Well metadata
export interface OMEAcquisition extends IStringAny {
  id: number;
  name?: string;
  maximumfieldcount?: number;
  description?: string;
  starttime?: number;
  endtime?: number;
}

export interface OMEColumn extends IStringAny {
  name: string;
}

export interface OMERow extends IStringAny {
  name: string;
}

export interface OMEWell extends IStringAny {
  path: string;
  rowIndex: number;
  columnIndex: number;
}

export interface OMEPlate extends IStringAny {
  acquisitions?: OMEAcquisition[];
  columns: OMEColumn[];
  rows: OMERow[];
  wells: OMEWell[];
  field_count?: number;
  name?: string;
  version?: string;
}

export interface OMEWellImage extends IStringAny {
  acquisition?: number;
  path: string;
}

export interface OMEWellMetadata extends IStringAny {
  images: OMEWellImage[];
  version?: string;
}

// Image Label metadata
export interface OMEImageLabel {
  version?: string;
  source?: {
    image?: string;
  };
  colors?: Array<{
    'label-value': number;
    rgba: [number, number, number, number];
  }>;
  properties?: Array<{
    'label-value': number;
    [key: string]: any;
  }>;
}

// Complete OME-Zarr properties interface
export default interface OMEAttrs extends IStringAny {
  multiscales?: OMEMultiscales[];
  omero?: OMEROMetadata;
  plate?: OMEPlate;
  well?: OMEWellMetadata;
  'image-label'?: OMEImageLabel;
  bioformats2raw?: {
    layout?: number;
  };
  [key: string]: any;
}

// Processed metadata for rendering
export interface ProcessedOMEMetadata {
  name?: string;
  defaultSelection: Record<string, number>;
  domains: Record<string, number[]>;
  channels: Array<{
    color: [number, number, number];
    window: [number, number];
    label: string;
    visible: boolean;
  }>;
  axis_labels: string[];
  axes: OMEAxes[];
}

// Source data configuration
export interface ImageLayerConfig {
  source: string;
  name?: string;
  opacity?: number;
  colormap?: string;
  model_matrix?: number[][];
}

// Final source data structure for Viv
export interface VivSourceData {
  loader: Array<{
    data: any; // Zarr array
    labels: string[];
    tileSize: number;
    index: number;
  }>; // Raw data array that can be converted to ZarrPixelSource
  axis_labels: string[];
  model_matrix: number[][];
  defaults: {
    selection: Record<string, number>;
    colormap: string;
    opacity: number;
  };
  name: string;
  channels: Array<{
    color: [number, number, number];
    window: [number, number];
    label: string;
    visible: boolean;
  }>;
  domains: Record<string, number[]>;
  labels?: any[];
}

// Legacy aliases for backward compatibility
export type OmeAxis = OMEAxes;
export type OmeMultiscale = OMEMultiscales;
export type OmeroMetadata = OMEROMetadata;
export type OmeCoordinateTransformation = OMECoordinateTransformation;
export type OmePlate = OMEPlate;
export type OmeWell = OMEWell;
export type OmeZarrAttrs = OMEAttrs;