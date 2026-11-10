import * as THREE from 'three';

import type { EmbeddingSource } from '../../../lib/utils/embeddings';

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
	/** Display name from the mesh index */
	name?: string;
	/** Per-glyph embedding vectors, if the mesh index lists them */
	embeddings?: EmbeddingSource;
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

/**
 * Visibility and selectability are shared by several controls (Filter, Adjacency), each with its
 * own reason, so that one control does not undo another. A mesh is visible while no control hides it.
 */
const toggleReason = (object: THREE.Object3D, key: 'hiddenBy' | 'unselectableBy', reason: string, active: boolean) => {
	const reasons: string[] = object.userData[key] ?? [];
	const next = active
		? (reasons.includes(reason) ? reasons : [...reasons, reason])
		: reasons.filter((existing) => existing !== reason);
	if (next.length > 0) object.userData[key] = next;
	else delete object.userData[key];
	return next.length;
};

export const setHiddenBy = (object: THREE.Object3D, reason: string, hidden: boolean) => {
	object.visible = toggleReason(object, 'hiddenBy', reason, hidden) === 0;
};

export const setUnselectableBy = (object: THREE.Object3D, reason: string, unselectable: boolean) => {
	toggleReason(object, 'unselectableBy', reason, unselectable);
};

/** Whether picking and polygon selection may select this mesh */
export const isSelectable = (object: THREE.Object3D) =>
	object.visible && !(object.userData.unselectableBy?.length > 0);

/**
 * Centre of each object of a layer (meshes with the same name form one object, e.g. a two-part glyph),
 * in the layer's absolute level-0 voxel coordinates. Uses the geometry, so Explode offsets are ignored.
 */
export const objectCentres = (group: THREE.Group) => {
	const boxes = new Map<string, THREE.Box3>();
	for (const mesh of nucleusMeshes(group)) {
		if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
		const box = boxes.get(mesh.name) ?? new THREE.Box3();
		boxes.set(mesh.name, box.union(mesh.geometry.boundingBox!));
	}
	return new Map([...boxes].map(([name, box]) => [name, box.getCenter(new THREE.Vector3())]));
};
