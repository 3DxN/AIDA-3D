import * as zarrita from 'zarrita'

import type { MeshEmbeddings } from './discoverSources'

/**
 * Per-glyph embedding vectors stored next to a mesh (see `embeddings` in the mesh index):
 * a (glyphs, dim) zarr array whose row `label-value - 1` belongs to the glyph `nucleus_<label-value>`.
 */

export interface EmbeddingSource extends MeshEmbeddings {
	/** Fetch the vector of one glyph; only its row is requested */
	readRow: (labelValue: number) => Promise<Float32Array>
}

export const embeddingRow = (labelValue: number) => {
	if (!Number.isInteger(labelValue) || labelValue < 1) {
		throw new Error(`label-value must be an integer ≥ 1, got ${labelValue}`)
	}
	return labelValue - 1
}

/** One source per mesh layer: the array metadata is opened once and reused for every selection */
export function openEmbeddingSource(store: zarrita.FetchStore, info: MeshEmbeddings): EmbeddingSource {
	let opened: Promise<zarrita.Array<zarrita.DataType, zarrita.FetchStore>> | null = null

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

	return {
		...info,
		readRow: async (labelValue) => {
			const row = embeddingRow(labelValue)
			const array = await open()
			if (row >= array.shape[0]) {
				throw new Error(`label-value ${labelValue} has no row in ${info.path} (${array.shape[0]} rows)`)
			}
			const { data } = await zarrita.get(array, [row, null])
			return data instanceof Float32Array ? data : Float32Array.from(data as ArrayLike<number>)
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
