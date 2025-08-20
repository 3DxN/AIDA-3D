import * as THREE from 'three';
import { Chunk, Uint32 } from 'zarrita';
import init, { MarchingCubes } from './pkg/marching_cubes';

// This function is now ASYNCHRONOUS because we need to load the WebAssembly module.
export const generateMeshesFromVoxelData = async (input: Chunk<Uint32>) => {
    // --- WebAssembly Module Initialisation ---
    // This loads and prepares the compiled Rust code.
    await init();
    const marchingCubes = MarchingCubes.new();
    // -----------------------------------------

    const meshDataArray = [];
    const { data, shape, stride } = input;
    const dims = shape; // e.g., [depth, height, width]

    // Accessor for the 1D strided array remains the same
    const getValue = (z: number, y: number, x: number) => data[z * stride[0] + y * stride[1] + x * stride[2]];

    const uniqueLabels = [...new Set(data)].filter(label => label > 0);

    for (const label of uniqueLabels) {
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
        if (isOnBoundary) {
            continue; // Skip to the next nucleus label
        }

        // Create a flat Uint8Array for the WebAssembly function.
        // This is much more efficient than a nested array.
        const binaryGrid = new Uint8Array(dims[0] * dims[1] * dims[2]).fill(0);
        for (const { x, y, z } of labelVoxels) {
            binaryGrid[z * stride[0] + y * stride[1] + x * stride[2]] = 1;
        }

        // --- Execute the WebAssembly Marching Cubes ---
        // Pass the volume data and dimensions to the Rust function.
        // Note the order of dimensions: width, height, depth (x, y, z) as expected by the wasm module.
        marchingCubes.set_volume(binaryGrid, dims[2], dims[1], dims[0]);
        const triangles = marchingCubes.marching_cubes(0.5); // The iso-level is 0.5
        // ----------------------------------------------

        // The 'triangles' variable is a flat Float32Array of vertices [x1, y1, z1, x2, y2, z2, ...].
        // We need to convert it into the format that three.js expects.
        const vertices: THREE.Vector3[] = [];
        for (let i = 0; i < triangles.length; i += 3) {
            vertices.push(new THREE.Vector3(triangles[i], triangles[i + 1], triangles[i + 2]));
        }

        // The wasm module gives us an ordered list of vertices that form the triangles,
        // so we can create a simple index array.
        const indices = Array.from({ length: vertices.length }, (_, i) => i);

        if (vertices.length > 0 && indices.length > 0) {
            meshDataArray.push({ label, vertices, indices });
        }
    }

    return meshDataArray;
};