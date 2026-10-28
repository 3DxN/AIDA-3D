import * as THREE from 'three';

/**
 * A block of 3D data in the scene. The most recently added layer is active:
 * it receives all label-specific UI controls. Older layers are frozen and stay static.
 * Layer groups hold meshes in absolute level-0 voxel coordinates.
 */
export interface SceneLayer {
	id: number;
	kind: 'labels' | 'gltf';
	/** Label group or mesh file path, relative to the store root */
	sourcePath: string;
	group: THREE.Group;
}

export const NUCLEUS_PREFIX = 'nucleus_';

export const createNucleusMaterial = () =>
	new THREE.MeshStandardMaterial({
		color: new THREE.Color('grey'),
		metalness: 0.1,
		roughness: 0.5,
		transparent: true,
		opacity: 1.0,
	});

export const nucleusMeshes = (group: THREE.Group) =>
	group.children.filter(
		(child) => (child as THREE.Mesh).isMesh && child.name.startsWith(NUCLEUS_PREFIX)
	) as THREE.Mesh[];

const cleanMaterial = (material: THREE.Material) => {
	material.dispose();
	for (const key of Object.keys(material)) {
		const value = material[key as keyof THREE.Material];
		if (value && typeof value === 'object' && 'minFilter' in value) {
			(value as any).dispose();
		}
	}
};

export const disposeObject = (object: THREE.Object3D) => {
	object.traverse((child) => {
		if (!(child as THREE.Mesh).isMesh) return;
		const mesh = child as THREE.Mesh;
		mesh.geometry.dispose();
		if (Array.isArray(mesh.material)) {
			mesh.material.forEach(cleanMaterial);
		} else {
			cleanMaterial(mesh.material as THREE.Material);
		}
	});
};

/** Remove selection highlighting before a layer is frozen */
export const clearHighlight = (group: THREE.Group) => {
	nucleusMeshes(group).forEach((mesh) =>
		(mesh.material as THREE.MeshStandardMaterial).emissive?.set(0x000000)
	);
};
