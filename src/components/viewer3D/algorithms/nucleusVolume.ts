import * as THREE from 'three';

// Function to calculate the signed volume of a tetrahedron
function signedVolumeOfTriangle(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): number {
    return p1.dot(p2.clone().cross(p3)) / 6.0;
}

// Function to calculate the volume of a mesh
export function calculateNucleusVolume(mesh: THREE.Mesh): number {
    const geometry = mesh.geometry;
    if (!geometry.isBufferGeometry) {
        console.error('Geometry is not BufferGeometry');
        return 0;
    }

    const position = geometry.attributes.position as THREE.BufferAttribute;
    let volume = 0.0;

    for (let i = 0; i < position.count; i += 3) {
        const p1 = new THREE.Vector3().fromBufferAttribute(position, i);
        const p2 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
        const p3 = new THREE.Vector3().fromBufferAttribute(position, i + 2);
        volume += signedVolumeOfTriangle(p1, p2, p3);
    }

    return Math.abs(volume);
}