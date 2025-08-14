import { VivView, DETAIL_VIEW_ID, OVERVIEW_VIEW_ID } from '@hms-dbmi/viv'
import { OrthographicView } from '@deck.gl/core'
import { PolygonLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import type { DragMode } from '../../../../types/viewer2D/frame'

export const FRAME_VIEW_ID = 'frame';

/**
 * Create interactive polygon frame overlay layers with handles
 */
export function createFrameOverlayLayers(
  frameCenter: [number, number],
  frameSize: [number, number],
  viewportId: string,
  options: {
    fillColor?: [number, number, number, number],
    lineColor?: [number, number, number, number],
    lineWidth?: number,
    filled?: boolean,
    stroked?: boolean,
    showHandles?: boolean,
    handleSize?: number,
    hoveredHandle?: string | null,
  } = {}
): PolygonLayer[] {
  const {
    lineColor = [255, 255, 255, 255] as [number, number, number, number],
    lineWidth = 3,
    showHandles = true,
    handleSize = 8,
    hoveredHandle = null,
  } = options;

  const [centerX, centerY] = frameCenter;
  const [width, height] = frameSize;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const layers: PolygonLayer[] = [];

  // Create the main frame polygon (frame outline)
  const framePolygon = [
    [centerX - halfWidth, centerY - halfHeight],
    [centerX + halfWidth, centerY - halfHeight],
    [centerX + halfWidth, centerY + halfHeight],
    [centerX - halfWidth, centerY + halfHeight],
    [centerX - halfWidth, centerY - halfHeight] // Close the polygon
  ];

  const frameData = [{ contour: framePolygon, type: 'frame' }];

  // Main frame border layer - NOT pickable so events pass through to detail view
  const frameLayerId = `frame-outline-#${viewportId}#`;
  const frameLayer = new PolygonLayer({
    id: frameLayerId,
    data: frameData,
    getPolygon: (d: any) => d.contour,
    getLineColor: lineColor,
    getFillColor: [0, 0, 0, 0], // Always transparent
    getLineWidth: lineWidth,
    lineWidthUnits: 'pixels',
    lineWidthScale: 0.5,
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 100,
    filled: false, // No fill to avoid interfering with events
    stroked: true,
    pickable: false, // NOT pickable - events pass through to detail view
    coordinateSystem: 0
  });

  layers.push(frameLayer);

  // Add a very transparent fill layer for visibility - also NOT pickable
  const fillLayerId = `frame-fill-#${viewportId}#`;
  const fillLayer = new PolygonLayer({
    id: fillLayerId,
    data: frameData,
    getPolygon: (d: any) => d.contour,
    getLineColor: [0, 0, 0, 0], // No border
    getFillColor: [255, 255, 255, 15], // Very transparent white fill for visibility
    filled: true,
    stroked: false,
    pickable: false, // NOT pickable - events pass through to detail view
    coordinateSystem: 0
  });

  layers.push(fillLayer);

  // Add a pickable frame area for moving the frame (separate from border/fill)
  const moveAreaLayerId = `frame-move-area-#${viewportId}#`;
  const moveAreaLayer = new PolygonLayer({
    id: moveAreaLayerId,
    data: [{ contour: framePolygon, type: 'move' }],
    getPolygon: (d: any) => d.contour,
    getLineColor: [0, 0, 0, 0], // Completely invisible
    getFillColor: [0, 0, 0, 0], // Completely invisible
    filled: true,
    stroked: false,
    pickable: true, // This layer is pickable for moving the frame
    coordinateSystem: 0
  });

  layers.push(moveAreaLayer);

  // Add corner and edge handles if enabled
  if (showHandles) {
    const handleColor = [255, 255, 255, 255] as [number, number, number, number];
    const handleFillColor = [100, 150, 255, 200] as [number, number, number, number];
    
    // Corner handles
    const corners = [
      { pos: [centerX - halfWidth, centerY - halfHeight], type: 'resize-nw' },
      { pos: [centerX + halfWidth, centerY - halfHeight], type: 'resize-ne' },
      { pos: [centerX + halfWidth, centerY + halfHeight], type: 'resize-se' },
      { pos: [centerX - halfWidth, centerY + halfHeight], type: 'resize-sw' },
    ];

    // Edge handles (midpoints)
    const edges = [
      { pos: [centerX, centerY - halfHeight], type: 'resize-n' },
      { pos: [centerX + halfWidth, centerY], type: 'resize-e' },
      { pos: [centerX, centerY + halfHeight], type: 'resize-s' },
      { pos: [centerX - halfWidth, centerY], type: 'resize-w' },
    ];

    const allHandles = [...corners, ...edges];

    allHandles.forEach((handle, index) => {
      const [x, y] = handle.pos;
      
      // Check if this handle is hovered
      const isHovered = hoveredHandle === handle.type;
      const currentHandleSize = isHovered ? handleSize * 1.8 : handleSize;
      const currentFillColor = isHovered 
        ? [255, 200, 100, 255] as [number, number, number, number] // Bright orange when hovered
        : handleFillColor;
      
      // Make handles larger for easier interaction
      const handlePolygon = [
        [x - currentHandleSize, y - currentHandleSize],
        [x + currentHandleSize, y - currentHandleSize],
        [x + currentHandleSize, y + currentHandleSize],
        [x - currentHandleSize, y + currentHandleSize],
        [x - currentHandleSize, y - currentHandleSize]
      ];

      const handleData = [{ contour: handlePolygon, type: handle.type, handleIndex: index }];

      // Only handles are pickable for interaction
      const handleLayer = new PolygonLayer({
        id: `frame-handle-${handle.type}-#${viewportId}#`,
        data: handleData,
        getPolygon: (d: any) => d.contour,
        getLineColor: handleColor,
        getFillColor: currentFillColor,
        getLineWidth: isHovered ? 4 : 3,
        lineWidthUnits: 'pixels',
        filled: true,
        stroked: true,
        pickable: true, // ONLY handles are pickable
        coordinateSystem: 0
      });

      layers.push(handleLayer);
    });
  }

  return layers;
}

/**
 * Helper function to determine cursor style based on drag mode
 */
export function getCursorForDragMode(dragMode: DragMode): string {
  switch (dragMode) {
    case 'move': return 'move';
    case 'resize-nw': return 'nw-resize';
    case 'resize-ne': return 'ne-resize';
    case 'resize-sw': return 'sw-resize';
    case 'resize-se': return 'se-resize';
    case 'resize-n': return 'n-resize';
    case 'resize-s': return 's-resize';
    case 'resize-e': return 'e-resize';
    case 'resize-w': return 'w-resize';
    default: return 'default';
  }
}

/**
 * Helper function to calculate new frame parameters during resize.
 * This version correctly clamps dimensions at a minimum size without "jolting".
 */
export function calculateFrameResize(
  dragMode: DragMode,
  startFrameCenter: [number, number],
  startFrameSize: [number, number],
  deltaX: number,
  deltaY: number
): { center: [number, number]; size: [number, number] } {
  const [startCenterX, startCenterY] = startFrameCenter;
  const [startWidth, startHeight] = startFrameSize;

  // Set the minimum and maximum frame size
  const MIN_FRAME_SIZE = 30;
  const MAX_FRAME_SIZE = 200;

  // Calculate the starting edges of the box
  let top = startCenterY - startHeight / 2;
  let bottom = startCenterY + startHeight / 2;
  let left = startCenterX - startWidth / 2;
  let right = startCenterX + startWidth / 2;

  // Adjust the edges based on the drag mode, with clamping
  switch (dragMode) {
    case "move":
      left += deltaX;
      right += deltaX;
      top += deltaY;
      bottom += deltaY;
      break;

    // --- Corner Handles ---
    case "resize-nw":
      left += deltaX;
      top += deltaY;
      // Clamp if needed
      if (right - left < MIN_FRAME_SIZE) left = right - MIN_FRAME_SIZE;
      if (bottom - top < MIN_FRAME_SIZE) top = bottom - MIN_FRAME_SIZE;
      // Clamp max size
      if (right - left > MAX_FRAME_SIZE) left = right - MAX_FRAME_SIZE;
      if (bottom - top > MAX_FRAME_SIZE) top = bottom - MAX_FRAME_SIZE;
      break;
    case "resize-ne":
      right += deltaX;
      top += deltaY;
      if (right - left < MIN_FRAME_SIZE) right = left + MIN_FRAME_SIZE;
      if (bottom - top < MIN_FRAME_SIZE) top = bottom - MIN_FRAME_SIZE;
      // Clamp max size
      if (right - left > MAX_FRAME_SIZE) right = left + MAX_FRAME_SIZE;
      if (bottom - top > MAX_FRAME_SIZE) top = bottom - MAX_FRAME_SIZE;
      break;
    case "resize-sw":
      left += deltaX;
      bottom += deltaY;
      if (right - left < MIN_FRAME_SIZE) left = right - MIN_FRAME_SIZE;
      if (bottom - top < MIN_FRAME_SIZE) bottom = top + MIN_FRAME_SIZE;
      // Clamp max size
      if (right - left > MAX_FRAME_SIZE) left = right - MAX_FRAME_SIZE;
      if (bottom - top > MAX_FRAME_SIZE) bottom = top + MAX_FRAME_SIZE;
      break;
    case "resize-se":
      right += deltaX;
      bottom += deltaY;
      if (right - left < MIN_FRAME_SIZE) right = left + MIN_FRAME_SIZE;
      if (bottom - top < MIN_FRAME_SIZE) bottom = top + MIN_FRAME_SIZE;
      // Clamp max size
      if (right - left > MAX_FRAME_SIZE) right = left + MAX_FRAME_SIZE;
      if (bottom - top > MAX_FRAME_SIZE) bottom = top + MAX_FRAME_SIZE;
      break;

    // --- Edge Handles ---
    case "resize-n":
      top += deltaY;
      if (bottom - top < MIN_FRAME_SIZE) top = bottom - MIN_FRAME_SIZE;
      // Clamp max size
      if (bottom - top > MAX_FRAME_SIZE) top = bottom - MAX_FRAME_SIZE;
      break;
    case "resize-s":
      bottom += deltaY;
      if (bottom - top < MIN_FRAME_SIZE) bottom = top + MIN_FRAME_SIZE;
      // Clamp max size
      if (bottom - top > MAX_FRAME_SIZE) bottom = top + MAX_FRAME_SIZE;
      break;
    case "resize-w":
      left += deltaX;
      if (right - left < MIN_FRAME_SIZE) left = right - MIN_FRAME_SIZE;
      // Clamp max size
      if (right - left > MAX_FRAME_SIZE) left = right - MAX_FRAME_SIZE;
      break;
    case "resize-e":
      right += deltaX;
      if (right - left < MIN_FRAME_SIZE) right = left + MIN_FRAME_SIZE;
      // Clamp max size
      if (right - left > MAX_FRAME_SIZE) right = left + MAX_FRAME_SIZE;
      break;

  }

  // Recalculate the final size and center from the clamped edges
  const newWidth = right - left;
  const newHeight = bottom - top;
  const newCenterX = left + newWidth / 2;
  const newCenterY = top + newHeight / 2;

  return {
    center: [newCenterX, newCenterY],
    size: [newWidth, newHeight],
  };
}

/**
 * Custom view that renders only a polygon frame overlay.
 * This view is designed to be overlaid on top of other views.
 */
export class FrameView extends VivView {
  constructor({ 
    id = FRAME_VIEW_ID, 
    x = 0, 
    y = 0, 
    height, 
    width
  }: any) {
    super({ id, x, y, height, width });
  }

  /**
   * Create a DeckGL view for the frame overlay.
   * Disable controller navigation to allow events to pass through to detail view when no pickable objects are hit.
   */
  getDeckGlView() {
    return new OrthographicView({
      controller: {
        dragPan: false,
        dragRotate: false,
        scrollZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        touchRotate: false,
        keyboard: false
      }, // Disable all navigation to allow picking only - events pass through to detail view
      id: this.id,
      height: this.height,
      width: this.width,
      x: this.x,
      y: this.y
    });
  }

  /**
   * Return frame overlay layers with interactive handles.
   */
  getLayers({ props, viewStates }: any): Layer[] {
    const layers: Layer[] = [];
    
    // Add the frame overlay layers if provided
    if (props.frameOverlayLayers && Array.isArray(props.frameOverlayLayers)) {
      layers.push(...props.frameOverlayLayers);
    }
    
    return layers;
  }

  /**
   * FrameView should follow the DetailView's view state for proper positioning.
   */
  filterViewState({ viewState, currentViewState }: any) {
    // Follow DetailView's view state for proper overlay positioning
    if (viewState.id === DETAIL_VIEW_ID) {
      return { ...viewState, id: this.id };
    }
    
    // Handle overview clicks for frame positioning
    if (viewState.id === OVERVIEW_VIEW_ID) {
      const { target } = viewState;
      if (target) {
        return { ...currentViewState, target, id: this.id };
      }
    }
    
    return super.filterViewState({ viewState, currentViewState });
  }
}
