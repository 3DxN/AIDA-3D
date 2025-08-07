// src/components/viewer3D/marchingCubes.ts

import * as THREE from 'three'
import { edgeTable, triTable } from './marchingCubesTables'

const interpolateVertex = (
	isoLevel: number,
	p1: THREE.Vector3,
	p2: THREE.Vector3,
	val1: number,
	val2: number
): THREE.Vector3 => {
	if (Math.abs(isoLevel - val1) < 0.00001) return p1
	if (Math.abs(isoLevel - val2) < 0.00001) return p2
	if (Math.abs(val1 - val2) < 0.00001) return p1

	const mu = (isoLevel - val1) / (val2 - val1)
	return new THREE.Vector3(
		p1.x + mu * (p2.x - p1.x),
		p1.y + mu * (p2.y - p1.y),
		p1.z + mu * (p2.z - p1.z)
	)
}

const march = (grid: number[][][], isoLevel: number) => {
	const vertices: THREE.Vector3[] = []
	const indices: number[] = []
	const vertexMap = new Map<string, number>()

	const dims = [grid.length, grid[0]?.length ?? 0, grid[0]?.[0]?.length ?? 0]

	for (let z = 0; z < dims[0] - 1; z++) {
		for (let y = 0; y < dims[1] - 1; y++) {
			for (let x = 0; x < dims[2] - 1; x++) {
				const p = [
					new THREE.Vector3(x, y, z),
					new THREE.Vector3(x + 1, y, z),
					new THREE.Vector3(x + 1, y + 1, z),
					new THREE.Vector3(x, y + 1, z),
					new THREE.Vector3(x, y, z + 1),
					new THREE.Vector3(x + 1, y, z + 1),
					new THREE.Vector3(x + 1, y + 1, z + 1),
					new THREE.Vector3(x, y + 1, z + 1),
				]

				const pointValues = [
					grid[z]?.[y]?.[x],
					grid[z]?.[y]?.[x + 1],
					grid[z]?.[y + 1]?.[x + 1],
					grid[z]?.[y + 1]?.[x],
					grid[z + 1]?.[y]?.[x],
					grid[z + 1]?.[y]?.[x + 1],
					grid[z + 1]?.[y + 1]?.[x + 1],
					grid[z + 1]?.[y + 1]?.[x],
				]
				const val = pointValues.map(v => v ?? 0)

				let cubeIndex = 0
				if (val[0] < isoLevel) cubeIndex |= 1
				if (val[1] < isoLevel) cubeIndex |= 2
				if (val[2] < isoLevel) cubeIndex |= 4
				if (val[3] < isoLevel) cubeIndex |= 8
				if (val[4] < isoLevel) cubeIndex |= 16
				if (val[5] < isoLevel) cubeIndex |= 32
				if (val[6] < isoLevel) cubeIndex |= 64
				if (val[7] < isoLevel) cubeIndex |= 128

				if (edgeTable[cubeIndex] === 0) continue

				// --- DEBUGGING BLOCK ---
				// This block will check for the invalid state before the crash occurs
				// and log the details to the console.
				if (triTable[cubeIndex] === undefined) {
					console.error('--- Marching Cubes Error: Invalid cubeIndex detected! ---');
					console.error(`Problem at grid coordinates (x,y,z): (${x}, ${y}, ${z})`);
					console.error(`Calculated cubeIndex: ${cubeIndex}`);
					console.error('This index is out of bounds for triTable (length 256).');
					console.error('Voxel values used for calculation (val array):', val);
					continue; // Skip this problematic cube to prevent a crash
				}
				// --- END DEBUGGING BLOCK ---

				const vertList: (THREE.Vector3 | undefined)[] = Array(12)

				// ... (rest of the function is the same)
				if (edgeTable[cubeIndex] & 1) vertList[0] = interpolateVertex(isoLevel, p[0], p[1], val[0], val[1])
				if (edgeTable[cubeIndex] & 2) vertList[1] = interpolateVertex(isoLevel, p[1], p[2], val[1], val[2])
				if (edgeTable[cubeIndex] & 4) vertList[2] = interpolateVertex(isoLevel, p[2], p[3], val[2], val[3])
				if (edgeTable[cubeIndex] & 8) vertList[3] = interpolateVertex(isoLevel, p[3], p[0], val[3], val[0])
				if (edgeTable[cubeIndex] & 16) vertList[4] = interpolateVertex(isoLevel, p[4], p[5], val[4], val[5])
				if (edgeTable[cubeIndex] & 32) vertList[5] = interpolateVertex(isoLevel, p[5], p[6], val[5], val[6])
				if (edgeTable[cubeIndex] & 64) vertList[6] = interpolateVertex(isoLevel, p[6], p[7], val[6], val[7])
				if (edgeTable[cubeIndex] & 128) vertList[7] = interpolateVertex(isoLevel, p[7], p[4], val[7], val[4])
				if (edgeTable[cubeIndex] & 256) vertList[8] = interpolateVertex(isoLevel, p[0], p[4], val[0], val[4])
				if (edgeTable[cubeIndex] & 512) vertList[9] = interpolateVertex(isoLevel, p[1], p[5], val[1], val[5])
				if (edgeTable[cubeIndex] & 1024) vertList[10] = interpolateVertex(isoLevel, p[2], p[6], val[2], val[6])
				if (edgeTable[cubeIndex] & 2048) vertList[11] = interpolateVertex(isoLevel, p[3], p[7], val[3], val[7])

				for (let i = 0; triTable[cubeIndex][i] !== -1; i += 3) {
					const triIndices = [0, 0, 0]
					for (let j = 0; j < 3; j++) {
						const edgeIndex = triTable[cubeIndex][i + j]
						const vertex = vertList[edgeIndex]
						if (!vertex) continue
						const vertexKey = `${vertex.x},${vertex.y},${vertex.z}`
						let vertIndex = vertexMap.get(vertexKey)
						if (vertIndex === undefined) {
							vertIndex = vertices.length
							vertices.push(vertex)
							vertexMap.set(vertexKey, vertIndex)
						}
						triIndices[j] = vertIndex
					}
					indices.push(triIndices[0], triIndices[1], triIndices[2])
				}
			}
		}
	}
	return { vertices, indices }
}


export const generateMeshesFromVoxelData = (voxelData: number[][][]) => {
	const meshDataArray = []
	const uniqueLabels = [...new Set(voxelData.flat(2))].filter(label => label > 0)
	const dims = [voxelData.length, voxelData[0]?.length ?? 0, voxelData[0]?.[0]?.length ?? 0]

	for (const label of uniqueLabels) {
		const binaryGrid = Array.from({ length: dims[0] }, () =>
			Array.from({ length: dims[1] }, () => new Array(dims[2]).fill(0))
		)
		for (let z = 0; z < dims[0]; z++) {
			for (let y = 0; y < dims[1]; y++) {
				for (let x = 0; x < dims[2]; x++) {
					if (voxelData[z]?.[y]?.[x] === label) {
						binaryGrid[z][y][x] = 1
					}
				}
			}
		}
		const { vertices, indices } = march(binaryGrid, 0.5)
		if (vertices.length > 0 && indices.length > 0) {
			meshDataArray.push({ label, vertices, indices })
		}
	}
	return meshDataArray
}