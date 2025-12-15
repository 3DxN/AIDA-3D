import * as zarr from "zarrita";
import type * as viv from "@vivjs/types";

// TODO: Export from top-level zarrita
type Slice = ReturnType<typeof zarr.slice>;

const X_AXIS_NAME = "x";
const Y_AXIS_NAME = "y";
const RGBA_CHANNEL_AXIS_NAME = "_c";

type VivPixelData = {
  data: zarr.TypedArray<Lowercase<viv.SupportedDtype>>;
  width: number;
  height: number;
};

/**
 * Dynamic resolution ZarrPixelSource that loads high-resolution tiles only within a specified region,
 * and low-resolution tiles elsewhere, with real-time cleanup.
 */
export default class DynamicResolutionZarrPixelSource implements viv.PixelSource<Array<string>> {
  readonly labels: viv.Properties<Array<string>>;
  readonly tileSize: number;
  readonly dtype: viv.SupportedDtype;
  
  private frameCenter: [number, number] = [0, 0];
  private frameSize: [number, number] = [100, 100];
  private highResolutionIndex: number = 0;
  private lowResolutionIndex: number;
  private allArrays: zarr.Array<zarr.NumberDataType | zarr.BigintDataType, zarr.Readable>[] = [];
  private transforms: Array<(arr: zarr.TypedArray<zarr.NumberDataType | zarr.BigintDataType>) => zarr.TypedArray<Lowercase<viv.SupportedDtype>>> = [];
  private highResTileCache = new Set<string>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  #pendingId: undefined | number = undefined;
  #pendingAbortController: AbortController | undefined = undefined;
  #pending: Array<{
    resolve: (data: VivPixelData) => void;
    reject: (err: unknown) => void;
    request: {
      selection: Array<number | zarr.Slice>;
      signal?: AbortSignal;
      resolutionIndex: number;
    };
  }> = [];

  constructor(
    arrays: zarr.Array<zarr.DataType, zarr.Readable>[], // Array of zarr arrays from high to low res
    options: { labels: viv.Properties<Array<string>>; tileSize: number }
  ) {
    this.allArrays = arrays as zarr.Array<zarr.NumberDataType | zarr.BigintDataType, zarr.Readable>[];
    this.labels = options.labels;
    this.tileSize = options.tileSize;
    this.lowResolutionIndex = arrays.length - 1;
    this.highResolutionIndex = 0;
    
    // Set dtype from the first array
    const firstArray = arrays[0];
    if (firstArray.dtype === "uint64" || firstArray.dtype === "int64") {
      this.dtype = "Uint32";
    } else if (firstArray.dtype === "float16") {
      this.dtype = "Float32";
    } else {
      this.dtype = capitalize(firstArray.dtype);
    }
    
    // Create transforms for each resolution
    this.transforms = arrays.map(arr => {
      if (arr.dtype === "uint64" || arr.dtype === "int64") {
        return (x) => Uint32Array.from(x as zarr.TypedArray<typeof arr.dtype>, (bint) => Number(bint));
      } else if (arr.dtype === "float16") {
        return (x) => new Float32Array(x as zarr.TypedArray<typeof arr.dtype>);
      } else {
        return (x) => x as zarr.TypedArray<typeof arr.dtype>;
      }
    });
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Update the frame region that should use high resolution
   */
  updateFrame(center: [number, number], size: [number, number]) {
    this.frameCenter = center;
    this.frameSize = size;
    
    // Trigger cleanup of tiles outside the new frame
    this.cleanupTilesOutsideFrame();
  }

  /**
   * Determine if a tile coordinate is within the high-resolution frame
   */
  private isTileInFrame(tileX: number, tileY: number): boolean {
    const [centerX, centerY] = this.frameCenter;
    const [width, height] = this.frameSize;
    
    // Calculate tile bounds
    const tileLeft = tileX * this.tileSize;
    const tileRight = (tileX + 1) * this.tileSize;
    const tileTop = tileY * this.tileSize;
    const tileBottom = (tileY + 1) * this.tileSize;
    
    // Calculate frame bounds
    const frameLeft = centerX - width / 2;
    const frameRight = centerX + width / 2;
    const frameTop = centerY - height / 2;
    const frameBottom = centerY + height / 2;
    
    // Check if tile intersects with frame
    return !(tileRight < frameLeft || tileLeft > frameRight || 
             tileBottom < frameTop || tileTop > frameBottom);
  }

  get #width() {
    const lastIndex = this.shape.length - 1;
    return this.shape[this.labels.indexOf("c") === lastIndex ? lastIndex - 1 : lastIndex];
  }

  get #height() {
    const lastIndex = this.shape.length - 1;
    return this.shape[this.labels.indexOf("c") === lastIndex ? lastIndex - 2 : lastIndex - 1];
  }

  get shape() {
    return this.allArrays[this.highResolutionIndex]?.shape || [];
  }

  async getRaster(options: {
    selection: viv.PixelSourceSelection<Array<string>> | Array<number>;
    signal?: AbortSignal;
  }): Promise<viv.PixelData> {
    const { selection, signal } = options;
    return this.#fetchData({
      selection: buildZarrSelection(selection, {
        labels: this.labels,
        slices: { x: zarr.slice(null), y: zarr.slice(null) },
      }),
      signal,
      resolutionIndex: this.highResolutionIndex
    });
  }

  onTileError(_err: unknown): void {
    // no-op
  }

  async getTile(options: {
    x: number;
    y: number;
    selection: viv.PixelSourceSelection<Array<string>> | Array<number>;
    signal?: AbortSignal;
  }): Promise<viv.PixelData> {
    const { x, y, selection, signal } = options;
    
    // Determine which resolution to use
    const useHighRes = this.isTileInFrame(x, y);
    const resolutionIndex = useHighRes ? this.highResolutionIndex : this.lowResolutionIndex;
    
    if (useHighRes) {
      // Track high-res tiles for cleanup
      const tileKey = `${x},${y}`;
      this.highResTileCache.add(tileKey);
    }
    
    return this.#fetchData({
      selection: buildZarrSelection(selection, {
        labels: this.labels,
        slices: {
          x: zarr.slice(x * this.tileSize, Math.min((x + 1) * this.tileSize, this.#width)),
          y: zarr.slice(y * this.tileSize, Math.min((y + 1) * this.tileSize, this.#height)),
        },
      }),
      signal,
      resolutionIndex
    });
  }

  async #fetchData(request: { selection: Array<number | Slice>; signal?: AbortSignal; resolutionIndex: number }): Promise<viv.PixelData> {
    const { promise, resolve, reject } = Promise.withResolvers<VivPixelData>();
    this.#pending.push({ request, resolve, reject });

    // If there's no pending animation frame scheduled, start a new batch
    if (this.#pendingId === undefined) {
      // Cancel any previous batch that might still be running
      if (this.#pendingAbortController) {
        this.#pendingAbortController.abort();
      }
      // Create a new AbortController for this batch
      this.#pendingAbortController = new AbortController();
      this.#pendingId = requestAnimationFrame(() => this.#fetchPending());
    }

    // @ts-expect-error - The missing generic ArrayBuffer type from Viv makes VivPixelData and viv.PixelData incompatible, even though they are.
    return promise;
  }

  /**
   * Fetch a pending batch of requests together and resolve independently.
   */
  async #fetchPending() {
    // Capture the current batch's AbortController
    const batchAbortController = this.#pendingAbortController;
    const batchSignal = batchAbortController?.signal;

    // Process all pending requests
    for (const { request, resolve, reject } of this.#pending) {
      const array = this.allArrays[request.resolutionIndex];
      const transform = this.transforms[request.resolutionIndex];

      if (!array || !transform) {
        console.warn(`Missing array or transform for resolution index ${request.resolutionIndex}`);
        reject(new Error(`Missing array or transform for resolution index ${request.resolutionIndex}`));
        continue;
      }

      // Merge the batch abort signal with any user-provided signal
      const signal = request.signal
        ? this.#mergeAbortSignals([batchSignal, request.signal])
        : batchSignal;

      try {
        const { data, shape } = await zarr.get(array, request.selection, { opts: { signal } });
        resolve({
          data: transform(data),
          width: shape[1],
          height: shape[0],
        });
      } catch (error) {
        // Don't reject with AbortError - it's expected when requests are cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          // Silently ignore cancelled requests
          continue;
        }
        console.error(`Failed to fetch data for resolution ${request.resolutionIndex}:`, error);
        reject(error);
      }
    }

    // Clear batch state
    this.#pendingId = undefined;
    this.#pending = [];
  }

  /**
   * Merge multiple abort signals into one.
   * The returned signal will abort when any of the input signals abort.
   */
  #mergeAbortSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    const actualSignals = signals.filter((s): s is AbortSignal => s !== undefined);

    for (const signal of actualSignals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }

  /**
   * Clean up high-resolution tiles that are no longer in the frame
   */
  private cleanupTilesOutsideFrame() {
    const tilesToRemove: string[] = [];
    
    for (const tileKey of this.highResTileCache) {
      const [x, y] = tileKey.split(',').map(Number);
      if (!this.isTileInFrame(x, y)) {
        tilesToRemove.push(tileKey);
      }
    }
    
    // Remove tiles from cache
    tilesToRemove.forEach(tileKey => {
      this.highResTileCache.delete(tileKey);
    });
    
    if (tilesToRemove.length > 0) {
      console.log(`Cleaned up ${tilesToRemove.length} high-res tiles outside frame`);
    }
  }

  /**
   * Start periodic cleanup of tiles outside the frame
   */
  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupTilesOutsideFrame();
    }, 2000); // Clean up every 2 seconds
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.highResTileCache.clear();
  }

}

function buildZarrSelection(
  baseSelection: Record<string, number> | Array<number>,
  options: {
    labels: string[];
    slices: { x: zarr.Slice; y: zarr.Slice };
  },
): Array<Slice | number> {
  const { labels, slices } = options;
  let selection: Array<Slice | number>;
  if (Array.isArray(baseSelection)) {
    // shallow copy
    selection = [...baseSelection];
  } else {
    // initialize with zeros
    selection = Array.from({ length: labels.length }, () => 0);
    // fill in the selection
    for (const [key, idx] of Object.entries(baseSelection)) {
      selection[labels.indexOf(key)] = idx;
    }
  }
  selection[labels.indexOf(X_AXIS_NAME)] = slices.x;
  selection[labels.indexOf(Y_AXIS_NAME)] = slices.y;
  if (RGBA_CHANNEL_AXIS_NAME in labels) {
    selection[labels.indexOf(RGBA_CHANNEL_AXIS_NAME)] = zarr.slice(null);
  }
  return selection;
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  // @ts-expect-error - TypeScript can't verify that the return type is correct
  return s[0].toUpperCase() + s.slice(1);
}