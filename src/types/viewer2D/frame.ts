// Frame state types for spatial frame management


export type FrameState = {
  center: [number, number];
  size: [number, number];
};


export type DragMode = 'none' | 'move'
  | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'
  | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w';


export interface FrameInteractionState {
  isDragging: boolean;
  dragMode: DragMode;
  startPos: [number, number];
  startFrameCenter: [number, number];
  startFrameSize: [number, number];
}
