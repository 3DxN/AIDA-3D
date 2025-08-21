import * as THREE from 'three';
// The import below is for TypeScript type definitions and won't affect the runtime path.
import init, { MarchingCubes } from '../../../../public/pkg/marching_cubes';

export interface MeshData {
    label: number;
    vertices: THREE.Vector3[];
    indices: number[];
}

let wasmLoaded = false;

export const generateMeshesFromVoxelDataWasm = async (
    voxelData: Uint8Array,
    dims: [number, number, number]
): Promise<MeshData[]> => {
    if (!wasmLoaded) {
        // CORRECTED PATH: This path is now relative to the root of the site,
        // which correctly points to the file in the `public` directory.
        await init('/pkg/marching_cubes_bg.wasm');
        wasmLoaded = true;
    }

    const marchingCubes = MarchingCubes.new();
    marchingCubes.set_volume(voxelData, dims[2], dims[1], dims[0]);

    const uniqueLabels = Array.from(new Set(voxelData)).filter(label => label !== 0);
    const meshDataArray: MeshData[] = [];
    // Use a fixed isovalue of 0.5 for binary volumes.
    const isoLevel = 0.5;

    for (const label of uniqueLabels) {
        // The second argument 'label' is passed here as per our Rust code changes.
        const verticesFloat32Array = marchingCubes.marching_cubes(isoLevel, label);

        const vertices: THREE.Vector3[] = [];
        const indices: number[] = [];

        // This check prevents the error if no surface is found for a label.
        if (verticesFloat32Array && verticesFloat32Array.length > 0) {
            for (let i = 0; i < verticesFloat32Array.length; i += 3) {
                vertices.push(
                    new THREE.Vector3(
                        verticesFloat32Array[i],
                        verticesFloat32Array[i + 1],
                        verticesFloat32Array[i + 2]
                    )
                );
                // Since the WASM function returns a flat list of vertices (not indexed),
                // we create a simple index array.
                indices.push(i / 3);
            }

            meshDataArray.push({
                label,
                vertices,
                indices,
            });
        }
    }

    return meshDataArray;
};