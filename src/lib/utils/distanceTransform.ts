/**
 * Exact squared Euclidean distance transform (Felzenszwalb & Huttenlocher, separable per axis).
 *
 * For every voxel of a [z, y, x] grid, the squared distance to the nearest voxel with mask = 1,
 * with `spacing` = [z, y, x] size of a voxel in the output unit (e.g. level-0 voxels).
 * Voxels with no structure anywhere in the grid get Infinity.
 */

const FAR = 1e20

// 1D lower envelope of parabolas: out[p] = min_q f[q] + (w (p - q))²
const transformLine = (
	f: Float64Array, n: number, w2: number,
	out: Float64Array, v: Int32Array, z: Float64Array
) => {
	let k = 0
	v[0] = 0
	z[0] = -Infinity
	z[1] = Infinity
	const intersect = (q: number, r: number) =>
		((f[q] + w2 * q * q) - (f[r] + w2 * r * r)) / (2 * w2 * (q - r))
	for (let q = 1; q < n; q++) {
		let s = intersect(q, v[k])
		// z[0] is -Infinity, so this stops at k = 0 at the latest
		while (s <= z[k]) {
			k--
			s = intersect(q, v[k])
		}
		k++
		v[k] = q
		z[k] = s
		z[k + 1] = Infinity
	}
	k = 0
	for (let p = 0; p < n; p++) {
		while (z[k + 1] < p) k++
		const r = v[k]
		out[p] = w2 * (p - r) * (p - r) + f[r]
	}
}

export function squaredDistanceTransform(
	mask: ArrayLike<number>,
	shape: [number, number, number],
	spacing: [number, number, number] = [1, 1, 1]
): Float32Array {
	const [nz, ny, nx] = shape
	const total = nz * ny * nx
	// Float32 is exact enough for squared voxel distances; each line is transformed in Float64
	const grid = new Float32Array(total)
	for (let i = 0; i < total; i++) grid[i] = mask[i] ? 0 : FAR

	const longest = Math.max(nz, ny, nx)
	const f = new Float64Array(longest)
	const out = new Float64Array(longest)
	const v = new Int32Array(longest)
	const z = new Float64Array(longest + 1)

	// Axis 2 (x), 1 (y), 0 (z): line length, stride along the line, and the strides of the other two axes
	const axes: [number, number, [number, number], [number, number]][] = [
		[nx, 1, [nz, ny * nx], [ny, nx]],
		[ny, nx, [nz, ny * nx], [nx, 1]],
		[nz, ny * nx, [ny, nx], [nx, 1]],
	]
	const weights = [spacing[2] ** 2, spacing[1] ** 2, spacing[0] ** 2]

	axes.forEach(([n, stride, [na, sa], [nb, sb]], axis) => {
		if (n < 2) return
		for (let a = 0; a < na; a++) {
			for (let b = 0; b < nb; b++) {
				const start = a * sa + b * sb
				for (let i = 0; i < n; i++) f[i] = grid[start + i * stride]
				transformLine(f, n, weights[axis], out, v, z)
				for (let i = 0; i < n; i++) grid[start + i * stride] = out[i]
			}
		}
	})

	for (let i = 0; i < total; i++) if (grid[i] >= FAR / 2) grid[i] = Infinity
	return grid
}
