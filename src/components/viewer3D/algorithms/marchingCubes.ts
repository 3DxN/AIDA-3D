import * as THREE from 'three'
import { edgeTable, triTable } from './marchingCubesTables'
import { Chunk, Uint32 } from 'zarrita'

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
				// Define the 8 vertices of the current cube
				// Following the standard marching cubes vertex indexing
				const p = [
					new THREE.Vector3(x, y, z),         // 0
					new THREE.Vector3(x + 1, y, z),     // 1
					new THREE.Vector3(x + 1, y + 1, z), // 2
					new THREE.Vector3(x, y + 1, z),     // 3
					new THREE.Vector3(x, y, z + 1),     // 4
					new THREE.Vector3(x + 1, y, z + 1), // 5
					new THREE.Vector3(x + 1, y + 1, z + 1), // 6
					new THREE.Vector3(x, y + 1, z + 1), // 7
				]

				// Get the scalar values at each vertex
				const pointValues = [
					grid[z]?.[y]?.[x] ?? 0,         // 0
					grid[z]?.[y]?.[x + 1] ?? 0,     // 1
					grid[z]?.[y + 1]?.[x + 1] ?? 0, // 2
					grid[z]?.[y + 1]?.[x] ?? 0,     // 3
					grid[z + 1]?.[y]?.[x] ?? 0,     // 4
					grid[z + 1]?.[y]?.[x + 1] ?? 0, // 5
					grid[z + 1]?.[y + 1]?.[x + 1] ?? 0, // 6
					grid[z + 1]?.[y + 1]?.[x] ?? 0, // 7
				]

				// Calculate cube index based on which vertices are below the iso level
				let cubeIndex = 0
				if (pointValues[0] < isoLevel) cubeIndex |= 1
				if (pointValues[1] < isoLevel) cubeIndex |= 2
				if (pointValues[2] < isoLevel) cubeIndex |= 4
				if (pointValues[3] < isoLevel) cubeIndex |= 8
				if (pointValues[4] < isoLevel) cubeIndex |= 16
				if (pointValues[5] < isoLevel) cubeIndex |= 32
				if (pointValues[6] < isoLevel) cubeIndex |= 64
				if (pointValues[7] < isoLevel) cubeIndex |= 128

				// Skip cubes that are completely inside or outside the isosurface
				if (edgeTable[cubeIndex] === 0) continue

				// Calculate intersection points on edges
				const vertList: (THREE.Vector3 | undefined)[] = Array(12)

				if (edgeTable[cubeIndex] & 1) vertList[0] = interpolateVertex(isoLevel, p[0], p[1], pointValues[0], pointValues[1])
				if (edgeTable[cubeIndex] & 2) vertList[1] = interpolateVertex(isoLevel, p[1], p[2], pointValues[1], pointValues[2])
				if (edgeTable[cubeIndex] & 4) vertList[2] = interpolateVertex(isoLevel, p[2], p[3], pointValues[2], pointValues[3])
				if (edgeTable[cubeIndex] & 8) vertList[3] = interpolateVertex(isoLevel, p[3], p[0], pointValues[3], pointValues[0])
				if (edgeTable[cubeIndex] & 16) vertList[4] = interpolateVertex(isoLevel, p[4], p[5], pointValues[4], pointValues[5])
				if (edgeTable[cubeIndex] & 32) vertList[5] = interpolateVertex(isoLevel, p[5], p[6], pointValues[5], pointValues[6])
				if (edgeTable[cubeIndex] & 64) vertList[6] = interpolateVertex(isoLevel, p[6], p[7], pointValues[6], pointValues[7])
				if (edgeTable[cubeIndex] & 128) vertList[7] = interpolateVertex(isoLevel, p[7], p[4], pointValues[7], pointValues[4])
				if (edgeTable[cubeIndex] & 256) vertList[8] = interpolateVertex(isoLevel, p[0], p[4], pointValues[0], pointValues[4])
				if (edgeTable[cubeIndex] & 512) vertList[9] = interpolateVertex(isoLevel, p[1], p[5], pointValues[1], pointValues[5])
				if (edgeTable[cubeIndex] & 1024) vertList[10] = interpolateVertex(isoLevel, p[2], p[6], pointValues[2], pointValues[6])
				if (edgeTable[cubeIndex] & 2048) vertList[11] = interpolateVertex(isoLevel, p[3], p[7], pointValues[3], pointValues[7])

				// Create triangles from the triangle table
				for (let i = 0; triTable[cubeIndex][i] !== -1; i += 3) {
					const triIndices = [0, 0, 0]
					for (let j = 0; j < 3; j++) {
						const edgeIndex = triTable[cubeIndex][i + j]
						const vertex = vertList[edgeIndex]
						if (!vertex) continue

						// Create a unique key for the vertex to avoid duplicates
						const vertexKey = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`
						let vertIndex = vertexMap.get(vertexKey)
						if (vertIndex === undefined) {
							vertIndex = vertices.length
							vertices.push(vertex)
							vertexMap.set(vertexKey, vertIndex)
						}
						triIndices[j] = vertIndex
					}
					// Add triangle with correct winding order (counter-clockwise when viewed from outside)
					indices.push(triIndices[0], triIndices[1], triIndices[2])
				}
			}
		}
	}
	return { vertices, indices }
}

// src/components/viewer3D/algorithms/marchingCubes.ts

// src/components/viewer3D/algorithms/marchingCubes.ts

// src/components/viewer3D/algorithms/marchingCubes.ts

export const generateMeshesFromVoxelData = (
	input: Chunk<Uint32>,
	currentZSlice?: number,
	filterIncompleteNuclei: boolean = true,
	voxelScale?: number[] // [z_scale, y_scale, x_scale] from OME metadata
) => {
	const meshDataArray = [];
	const { data, shape, stride } = input;
	const dims = shape; // e.g., [depth, height, width]
	const allVoxelValues = data; // The flat TypedArray

	// Accessor for the 1D strided array
	const getValue = (z: number, y: number, x: number) => data[z * stride[0] + y * stride[1] + x * stride[2]];

	const uniqueProperties = [...new Set(allVoxelValues)].filter(label => label > 0);

	for (const label of uniqueProperties) {
		let isOnBoundary = false;
		const labelVoxels = [];

		// First, find all voxels for the current label and check for boundaries
		for (let z = 0; z < dims[0]; z++) {
			for (let y = 0; y < dims[1]; y++) {
				for (let x = 0; x < dims[2]; x++) {
					if (getValue(z, y, x) === label) {
						labelVoxels.push({ x, y, z });
						if (!isOnBoundary && (x === 0 || x === dims[2] - 1 || y === 0 || y === dims[1] - 1 || z === 0 || z === dims[0] - 1)) {
							isOnBoundary = true;
						}
					}
				}
			}
		}

		// If this nucleus is on the boundary, we will not generate a mesh for it at all.
		if (isOnBoundary && filterIncompleteNuclei) {
			continue; // Skip to the next nucleus label
		}

		// If not on the boundary, proceed with mesh generation
		const binaryGrid = Array.from({ length: dims[0] }, () =>
			Array.from({ length: dims[1] }, () => new Array(dims[2]).fill(0))
		);

		for (const { x, y, z } of labelVoxels) {
			binaryGrid[z][y][x] = 1;
		}

		const { vertices, indices } = march(binaryGrid, 0.5);

		if (vertices.length > 0 && indices.length > 0) {
			// Get voxel scale factors (default to 1.0 if not provided)
			const zScale = voxelScale?.[0] ?? 1.0;
			const yScale = voxelScale?.[1] ?? 1.0;
			const xScale = voxelScale?.[2] ?? 1.0;

			// Transform vertices to global coordinate system relative to origin
			const transformedVertices = vertices.map(vertex => {
				// Center x and y around origin (same as plane positioning)
				const centeredX = vertex.x - dims[2] / 2;
				const centeredY = vertex.y - dims[1] / 2;

				// Transform z so that currentZSlice becomes z=0
				// currentZSlice should be at z=0, layers below in negative z, layers above in positive z
				const currentZ = currentZSlice !== undefined ? currentZSlice : dims[0] / 2;
				const transformedZ = vertex.z - currentZ; // Direct offset from current slice

				// Apply voxel scale factors to correct for anisotropic voxels
				// This ensures proper proportions when X/Y resolution changes but Z stays the same
				const scaledX = centeredX * xScale;
				const scaledY = centeredY * yScale;
				const scaledZ = transformedZ * zScale;

				return new THREE.Vector3(scaledX, scaledY, scaledZ);
			});
			meshDataArray.push({ label, vertices: transformedVertices, indices });
		}
	}

	return meshDataArray;
};