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

/*
 * Alternate ZarrPixelSource implementation for Viv
 * Fixes the "unsupported dtype" errors
 * Source: https://github.com/hms-dbmi/vizarr/blob/main/src/ZarrPixelSource.ts
 */
export default class ZarrPixelSource implements viv.PixelSource<Array<string>> {
  readonly labels: viv.Properties<Array<string>>;
  readonly tileSize: number;
  readonly dtype: viv.SupportedDtype;
  readonly #arr: zarr.Array<zarr.NumberDataType | zarr.BigintDataType, zarr.Readable>;
  readonly #transform: (
    arr: zarr.TypedArray<zarr.NumberDataType | zarr.BigintDataType>,
  ) => zarr.TypedArray<Lowercase<viv.SupportedDtype>>;

  #pendingId: undefined | number = undefined;
  #pendingAbortController: AbortController | undefined = undefined;
  #pending: Array<{
    resolve: (data: VivPixelData) => void;
    reject: (err: unknown) => void;
    request: {
      selection: Array<number | zarr.Slice>;
      signal?: AbortSignal;
    };
  }> = [];

  constructor(
    arr: zarr.Array<zarr.DataType, zarr.Readable>,
    options: { labels: viv.Properties<Array<string>>; tileSize: number },
  ) {
    assert(arr.is("number") || arr.is("bigint"), `Unsupported viv dtype: ${arr.dtype}`);
    this.#arr = arr;
    this.labels = options.labels;
    this.tileSize = options.tileSize;
    /**
     * Some `zarrita` data types are not supported by Viv and require casting.
     *
     * Note how the casted type in the transform function is type-cast to `zarr.TypedArray<typeof arr.dtype>`.
     * This ensures that the function body is correct based on whatever type narrowing we do in the if/else
     * blocks based on dtype.
     *
     * TODO: Maybe we should add a console warning?
     */
    if (arr.dtype === "uint64" || arr.dtype === "int64") {
      this.dtype = "Uint32";
      this.#transform = (x) => Uint32Array.from(x as zarr.TypedArray<typeof arr.dtype>, (bint) => Number(bint));
    } else if (arr.dtype === "float16") {
      this.dtype = "Float32";
      this.#transform = (x) => new Float32Array(x as zarr.TypedArray<typeof arr.dtype>);
    } else {
      this.dtype = capitalize(arr.dtype);
      this.#transform = (x) => x as zarr.TypedArray<typeof arr.dtype>;
    }
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
    return this.#arr.shape;
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
        arrayRank: this.#arr.shape.length,
        shape: this.#arr.shape,
      }),
      signal,
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
    return this.#fetchData({
      selection: buildZarrSelection(selection, {
        labels: this.labels,
        slices: {
          x: zarr.slice(x * this.tileSize, Math.min((x + 1) * this.tileSize, this.#width)),
          y: zarr.slice(y * this.tileSize, Math.min((y + 1) * this.tileSize, this.#height)),
        },
        arrayRank: this.#arr.shape.length,
        shape: this.#arr.shape,
      }),
      signal,
    });
  }

  async #fetchData(request: { selection: Array<number | Slice>; signal?: AbortSignal }): Promise<viv.PixelData> {
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
   *
   * TODO: There could be more optimizations (e.g., multi-get)
   */
  async #fetchPending() {
    // Capture the current batch's AbortController
    const batchAbortController = this.#pendingAbortController;
    const batchSignal = batchAbortController?.signal;

    // Process all pending requests
    for (const { request, resolve, reject } of this.#pending) {
      // Merge the batch abort signal with any user-provided signal
      const signal = request.signal
        ? this.#mergeAbortSignals([batchSignal, request.signal])
        : batchSignal;

      zarr
        .get(this.#arr, request.selection, { opts: { signal } })
        .then(({ data, shape }) => {
          const transformedData = this.#transform(data);

          resolve({
            data: transformedData,
            width: shape[1],
            height: shape[0],
          });
        })
        .catch((error) => {
          // Don't reject with AbortError - it's expected when requests are cancelled
          if (error instanceof Error && error.name === 'AbortError') {
            // Silently ignore cancelled requests
            return;
          }
          reject(error);
        });
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

}

function buildZarrSelection(
  baseSelection: Record<string, number> | Array<number>,
  options: {
    labels: string[];
    slices: { x: zarr.Slice; y: zarr.Slice };
    arrayRank: number; // For pruning
    shape: number[];   // For clamping
  },
): Array<Slice | number> {
  const { labels, slices, arrayRank, shape } = options;
  let selection: Array<Slice | number>;
  
  selection = Array.from({ length: labels.length }, () => 0);

  if (Array.isArray(baseSelection)) {
    for (let i = 0; i < Math.min(baseSelection.length, selection.length); i++) {
      selection[i] = typeof baseSelection[i] === 'number' 
        ? Math.max(0, Math.min(baseSelection[i] as number, shape[i] - 1))
        : baseSelection[i];
    }
  } else {
    for (const [key, idx] of Object.entries(baseSelection)) {
      const labelIndex = labels.indexOf(key);
      if (labelIndex !== -1 && labelIndex < selection.length) {
        selection[labelIndex] = typeof idx === 'number' 
          ? Math.max(0, Math.min(idx, shape[labelIndex] - 1)) 
          : idx;
      }
    }
  }

  const xIdx = labels.indexOf(X_AXIS_NAME);
  const yIdx = labels.indexOf(Y_AXIS_NAME);
  
  if (xIdx !== -1 && xIdx < selection.length) selection[xIdx] = slices.x;
  if (yIdx !== -1 && yIdx < selection.length) selection[yIdx] = slices.y;
  
  const cIdx = labels.indexOf(RGBA_CHANNEL_AXIS_NAME);
  if (cIdx !== -1 && cIdx < selection.length) {
    selection[cIdx] = zarr.slice(null);
  }

  return selection.slice(0, arrayRank);
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  // @ts-expect-error - TypeScript can't verify that the return type is correct
  return s[0].toUpperCase() + s.slice(1);
}

export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new Error(msg);
  }
}