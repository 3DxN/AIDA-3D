import * as THREE from 'three';
import { generateMeshesFromVoxelDataWasm } from './marchingCubesWasm';

export interface MeshData {
    label: number;
    vertices: THREE.Vector3[];
    indices: number[];
}

export const generateMeshesFromVoxelData = async (
    voxelData: Uint8Array,
    dims: [number, number, number]
): Promise<MeshData[]> => {
    // We are now exclusively using the WASM implementation
    return generateMeshesFromVoxelDataWasm(voxelData, dims);
};