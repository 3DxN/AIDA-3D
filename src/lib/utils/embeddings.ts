import * as zarrita from 'zarrita'

import type { MeshEmbeddings } from './discoverSources'

/**
 * Per-glyph embedding vectors stored next to a mesh (see `embeddings` in the mesh index):
 * a (glyphs, dim) zarr array whose row `label-value - 1` belongs to the glyph `nucleus_<label-value>`.
 */

export interface EmbeddingSource extends MeshEmbeddings {
	/** The vector of one glyph; read from the cached chunk holding its row, fetching that chunk if needed */
	readRow: (labelValue: number) => Promise<Float32Array>
}

export const embeddingRow = (labelValue: number) => {
	if (!Number.isInteger(labelValue) || labelValue < 1) {
		throw new Error(`label-value must be an integer ≥ 1, got ${labelValue}`)
	}
	return labelValue - 1
}

// Recently read row chunks kept per source; a chunk can hold every row of the array (several MB)
const MAX_CACHED_CHUNKS = 4

/**
 * One source per mesh layer: the array metadata is opened once, and each chunk of rows is fetched once
 * and reused for every selection of a glyph in it.
 */
export function openEmbeddingSource(store: zarrita.FetchStore, info: MeshEmbeddings): EmbeddingSource {
	let opened: Promise<zarrita.Array<zarrita.DataType, zarrita.FetchStore>> | null = null
	// Row-chunk index → all rows of that chunk, C order; Map order is least to most recently used
	const chunks = new Map<number, Promise<Float32Array>>()

	const open = () => {
		opened ??= zarrita.open(zarrita.root(store).resolve(info.path), { kind: 'array' })
			.then((array) => {
				if (array.shape.length !== 2) {
					throw new Error(`${info.path}: expected a (glyphs, dim) array, got shape (${array.shape.join(', ')})`)
				}
				return array
			})
			.catch((error) => {
				// Allow a retry on the next selection, e.g. after a network error
				opened = null
				throw error
			})
		return opened
	}

	const readChunk = (array: zarrita.Array<zarrita.DataType, zarrita.FetchStore>, chunk: number) => {
		let rows = chunks.get(chunk)
		if (rows) {
			chunks.delete(chunk)
		} else {
			const start = chunk * array.chunks[0]
			const end = Math.min(start + array.chunks[0], array.shape[0])
			// Spans all column chunks of these rows
			rows = zarrita.get(array, [zarrita.slice(start, end), null]).then(
				({ data }) => (data instanceof Float32Array ? data : Float32Array.from(data as ArrayLike<number>)),
				(error) => {
					chunks.delete(chunk)
					throw error
				}
			)
		}
		chunks.set(chunk, rows)
		if (chunks.size > MAX_CACHED_CHUNKS) chunks.delete(chunks.keys().next().value!)
		return rows
	}

	return {
		...info,
		readRow: async (labelValue) => {
			const row = embeddingRow(labelValue)
			const array = await open()
			const [rowCount, dim] = array.shape
			if (row >= rowCount) {
				throw new Error(`label-value ${labelValue} has no row in ${info.path} (${rowCount} rows)`)
			}
			const chunk = Math.floor(row / array.chunks[0])
			const rows = await readChunk(array, chunk)
			const offset = (row - chunk * array.chunks[0]) * dim
			// A copy, so callers cannot change the cached chunk
			return rows.slice(offset, offset + dim)
		},
	}
}

/** Fixed-width text block of the values, a few per line */
export const formatVector = (vector: ArrayLike<number>, decimals = 4, perLine = 8) => {
	const values = Array.from(vector, (value) => value.toFixed(decimals))
	const width = Math.max(0, ...values.map((value) => value.length))
	const lines: string[] = []
	for (let i = 0; i < values.length; i += perLine) {
		const index = String(i).padStart(String(values.length).length, ' ')
		lines.push(`${index}: ${values.slice(i, i + perLine).map((value) => value.padStart(width, ' ')).join(' ')}`)
	}
	return lines.join('\n')
}
