/**
 * Represents a single point (vertex) in an ROI polygon.
 * Coordinates are in world coordinates (same as image data coordinates).
 */
export interface ROIVertex {
    x: number
    y: number
}

/**
 * Represents a single ROI polygon with its metadata.
 */
export interface ROI {
    /** Unique identifier for the ROI */
    id: string
    /** User-provided text label for the ROI */
    label: string
    /** Array of vertices defining the polygon (minimum 3 for a valid polygon) */
    vertices: ROIVertex[]
    /** Z-slice on which this ROI was created */
    zSlice: number
    /** Timestamp of creation (for sorting/display purposes) */
    createdAt: number
}

/**
 * Bounding box computed from ROI vertices for navigation.
 */
export interface ROIBoundingBox {
    minX: number
    maxX: number
    minY: number
    maxY: number
    centerX: number
    centerY: number
    width: number
    height: number
}

/**
 * Drawing state for polygon creation.
 */
export interface ROIDrawingState {
    /** Whether currently in drawing mode */
    isDrawing: boolean
    /** Vertices collected so far during drawing */
    currentVertices: ROIVertex[]
    /** Current mouse position for preview line (from last vertex to cursor) */
    previewVertex: ROIVertex | null
}
