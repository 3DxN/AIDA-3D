import * as THREE from 'three';
import { Chunk, Uint32 } from 'zarrita';
import init, { MarchingCubes } from './pkg/marching_cubes';

export const generateMeshesFromVoxelData = async (input: Chunk<Uint32> | null) => {
    if (!input || !input.data || input.data.length === 0) {
        console.error("Marching Cubes: Input data is null or empty.");
        return [];
    }

    try {
        await init();
    } catch (e) {
        // This can happen in development with React's strict mode and HMR.
        // It's usually safe to ignore, as the module is already initialized.
    }

    const marchingCubes = MarchingCubes.new();
    const meshDataArray = [];
    const { data, shape, stride } = input;
    const [depth, height, width] = shape;

    // This helper function correctly reads a voxel value from the
    // non-contiguous Zarr data array using its strides.
    const getValue = (z: number, y: number, x: number): number => {
        return data[z * stride[0] + y * stride[1] + x * stride[2]];
    };

    const uniqueLabels = [...new Set(data)].filter(label => label > 0);

    for (const label of uniqueLabels) {
        // Create a new, simple, contiguous binary grid. The wasm module expects this.
        const binaryGrid = new Uint8Array(depth * height * width);

        // **The Critical Fix:**
        // We must iterate through the source data using its native dimensions (z, y, x)
        // and map it to a standard, contiguous (non-strided) flat array.
        // The wasm module will interpret this flat array as having a C-style memory layout.
        for (let z = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // Check the value in the original strided data
                    if (getValue(z, y, x) === label) {
                        // Calculate the correct index for a standard, contiguous C-order array
                        const flatIndex = z * height * width + y * width + x;
                        binaryGrid[flatIndex] = 1;
                    }
                }
            }
        }

        // Run the WebAssembly marching cubes on the correctly formatted binary grid.
        marchingCubes.set_volume(binaryGrid, width, height, depth);
        const triangles = marchingCubes.marching_cubes(0.5);

        if (triangles.length > 0) {
            const vertices: THREE.Vector3[] = [];
            for (let i = 0; i < triangles.length; i += 3) {
                vertices.push(new THREE.Vector3(triangles[i], triangles[i + 1], triangles[i + 2]));
            }
            const indices = Array.from({ length: vertices.length }, (_, i) => i);
            meshDataArray.push({ label, vertices, indices });
        }
    }

    return meshDataArray;
};