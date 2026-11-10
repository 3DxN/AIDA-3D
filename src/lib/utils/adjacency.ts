import * as zarrita from 'zarrita'

import { squaredDistanceTransform } from './distanceTransform'

/**
 * Distance of 3D objects to a reference label map (e.g. a tissue segmentation), in level-0 voxels.
 *
 * The reference is read at one resolution level and turned into a distance field once; looking up an
 * object is then a single array access, so the distance threshold can change interactively.
 * Distances are measured between voxel centres of that level, so they are accurate to about half its
 * voxel size.
 */

export interface LabelLevel {
	path: string
	array: zarrita.Array<zarrita.DataType, zarrita.FetchStore>
	/** [z, y, x] extent of the level */
	shape: [number, number, number]
	/** [z, y, x] voxel size of the level in level-0 voxels */
	scale: [number, number, number]
}

export interface DistanceField {
	/** Squared distance in level-0 voxels² per voxel of the level; Infinity without any structure */
	dist2: Float32Array
	shape: [number, number, number]
	scale: [number, number, number]
	structureVoxels: number
}

const lastThree = (values: number[]) => values.slice(-3) as [number, number, number]

const zyx = (shape: number[]): [number, number, number] =>
	shape.length >= 3 ? lastThree(shape) : [1, shape[shape.length - 2] ?? 1, shape[shape.length - 1] ?? 1]

export const voxelCount = (level: Pick<LabelLevel, 'shape'>) => level.shape[0] * level.shape[1] * level.shape[2]

/** Resolution levels of an NGFF label image; scales are relative to the first level */
export async function openLabelLevels(store: zarrita.FetchStore, groupPath: string): Promise<LabelLevel[]> {
	const group = await zarrita.open(zarrita.root(store).resolve(groupPath), { kind: 'group' })
	const attrs = group.attrs as Record<string, any>
	const datasets: any[] | undefined = (attrs.ome ?? attrs).multiscales?.[0]?.datasets
	if (!Array.isArray(datasets) || datasets.length === 0) {
		throw new Error(`${groupPath}: no multiscales datasets found`)
	}

	const scaleOf = (dataset: any): number[] =>
		(dataset.coordinateTransformations ?? []).find((t: any) => t.type === 'scale')?.scale ?? [1, 1, 1]
	const base = lastThree(scaleOf(datasets[0]))

	return Promise.all(datasets.map(async (dataset) => {
		const array = await zarrita.open(group.resolve(dataset.path), { kind: 'array' })
		const scale = lastThree(scaleOf(dataset)).map((value, axis) => value / (base[axis] || 1)) as [number, number, number]
		return { path: dataset.path, array, shape: zyx(array.shape), scale }
	}))
}

/** Finest level that stays below the voxel budget, else the coarsest */
export const pickLevel = (levels: Pick<LabelLevel, 'shape'>[], maxVoxels = 16_000_000) => {
	const index = levels.findIndex((level) => voxelCount(level) <= maxVoxels)
	return index >= 0 ? index : levels.length - 1
}

/** Parse "3, 7 12" into label values; empty means any non-zero label */
export const parseLabelValues = (text: string): number[] | null => {
	const parts = text.split(/[\s,;]+/).filter(Boolean)
	if (parts.length === 0) return []
	const values = parts.map(Number)
	return values.every((value) => Number.isInteger(value) && value > 0) ? values : null
}

/** Build the distance field to the voxels of `labelValues` (all non-zero labels if empty) */
export async function computeDistanceField(level: LabelLevel, labelValues: number[] = []): Promise<DistanceField> {
	const { array, shape, scale } = level
	// Leading axes such as c or t: first index
	const selection = array.shape.map((_, axis) => (axis < array.shape.length - 3 ? 0 : null))
	const { data } = await zarrita.get(array, selection)
	const values = data as ArrayLike<number | bigint>

	const wanted = new Set(labelValues)
	const mask = new Uint8Array(values.length)
	let structureVoxels = 0
	for (let i = 0; i < values.length; i++) {
		const value = Number(values[i])
		if (value !== 0 && (wanted.size === 0 || wanted.has(value))) {
			mask[i] = 1
			structureVoxels++
		}
	}

	return { dist2: squaredDistanceTransform(mask, shape, scale), shape, scale, structureVoxels }
}

/**
 * Distance in level-0 voxels from a point (x, y, z in level-0 voxel coordinates) to the structure.
 * Points outside the label map are measured from the nearest voxel at its border.
 */
export function distanceAt(field: DistanceField, [x, y, z]: [number, number, number]): number {
	const { dist2, shape, scale } = field
	let extra = 0
	const index = [z, y, x].map((coordinate, axis) => {
		// Voxel i of the level covers level-0 voxels [i*s, (i+1)*s), centred at i*s + (s-1)/2
		const s = scale[axis]
		const raw = Math.round((coordinate - (s - 1) / 2) / s)
		const clamped = Math.min(shape[axis] - 1, Math.max(0, raw))
		if (clamped !== raw) extra += (coordinate - (clamped * s + (s - 1) / 2)) ** 2
		return clamped
	})
	return Math.sqrt(dist2[(index[0] * shape[1] + index[1]) * shape[2] + index[2]] + extra)
}
