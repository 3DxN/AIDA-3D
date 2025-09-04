import * as THREE from 'three';

// Function to calculate the diameter of a mesh
export function calculateNucleusDiameter(mesh: THREE.Mesh): number {
    const geometry = mesh.geometry;
    if (!geometry.isBufferGeometry) {
        console.error('Geometry is not BufferGeometry');
        return 0;
    }

    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;

    if (!boundingBox) {
        return 0;
    }

    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    return size.length();
}