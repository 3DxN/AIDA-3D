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
 * Standard ZarrPixelSource for AIDA-3D
 * Version: 1.2.5 - Strict WebGL Padding
 */
console.log("💎 Renderer v1.2.5 (Strict WebGL Alignment) Online");

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
    const pixelData = await this.#fetchData({
      selection: buildZarrSelection(selection, {
        labels: this.labels,
        slices: { x: zarr.slice(null), y: zarr.slice(null) },
        arrayRank: this.#arr.shape.length,
        shape: this.#arr.shape,
      }),
      signal,
    });
    if (pixelData.data instanceof Int8Array) {
        return { ...pixelData, data: new Uint8Array(pixelData.data.buffer) };
    }
    return pixelData;
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
    const pixelData = await this.#fetchData({
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
    if (pixelData.data instanceof Int8Array) {
        return { ...pixelData, data: new Uint8Array(pixelData.data.buffer) };
    }
    return pixelData;
  }

  async #fetchData(request: { selection: Array<number | Slice>; signal?: AbortSignal }): Promise<viv.PixelData> {
    const { promise, resolve, reject } = Promise.withResolvers<VivPixelData>();
    this.#pending.push({ request, resolve, reject });

    if (this.#pendingId === undefined) {
      if (this.#pendingAbortController) {
        this.#pendingAbortController.abort();
      }
      this.#pendingAbortController = new AbortController();
      this.#pendingId = requestAnimationFrame(() => this.#fetchPending());
    }

    return promise;
  }

  async #fetchPending() {
    const batchAbortController = this.#pendingAbortController;
    const batchSignal = batchAbortController?.signal;

    const currentPending = [...this.#pending];
    this.#pendingId = undefined;
    this.#pending = [];

    for (let i = 0; i < currentPending.length; i++) {
      const item = currentPending[i];
      const signal = item.request.signal
        ? this.#mergeAbortSignals([batchSignal, item.request.signal])
        : batchSignal;

      zarr.get(this.#arr, item.request.selection, { opts: { signal } })
        .then((result) => {
          // 🛡️ ISSUE 2: Explicit variable capture to handle stale browser cache
          const rawData = result.data;
          const rawShape = result.shape;
          const transformed = this.#transform(rawData);
          
          const actualWidth = rawShape.length > 1 ? rawShape[1] : (rawShape.length > 0 ? rawShape[0] : 0);
          const actualHeight = rawShape.length > 0 ? rawShape[0] : 0;
          
          // 🛡️ ISSUE 3: Pad to tileSize x tileSize for WebGL compatibility
          const expectedLength = this.tileSize * this.tileSize;
          let finalBuffer: any = transformed;

          if (finalBuffer.length !== expectedLength) {
              const padded = new (finalBuffer.constructor as any)(expectedLength);
              // Copy row by row to maintain alignment if width < tileSize
              if (actualWidth > 0 && actualHeight > 0) {
                  for (let row = 0; row < actualHeight; row++) {
                      const srcOffset = row * actualWidth;
                      const dstOffset = row * this.tileSize;
                      padded.set(finalBuffer.slice(srcOffset, srcOffset + actualWidth), dstOffset);
                  }
              }
              finalBuffer = padded;
          }

          // Deck.gl Texture Safety
          if (finalBuffer instanceof Int8Array) {
              finalBuffer = new Uint8Array(finalBuffer.buffer);
          }

          // Always return tileSize dimensions to Deck.gl
          item.resolve({ data: finalBuffer, width: this.tileSize, height: this.tileSize });
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          item.reject(err);
        });
    }
  }

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
    arrayRank: number; 
    shape: number[];   
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