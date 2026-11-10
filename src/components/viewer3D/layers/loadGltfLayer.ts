import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

import { NUCLEUS_PREFIX, createNucleusMaterial, disposeObject } from './sceneLayers';

const LABEL_KEY = 'label-value';

// glTF `extras` end up in userData, on the node or on the mesh depending on the file layout
const findLabel = (object: THREE.Object3D | null): number | undefined => {
	for (let current = object; current; current = current.parent) {
		const value = Number(current.userData?.[LABEL_KEY]);
		if (current.userData?.[LABEL_KEY] !== undefined && Number.isFinite(value)) return value;
	}
	return undefined;
};

/**
 * Load a glTF/GLB file whose vertices are in level-0 voxel units (x, y, z) and
 * convert it into a flat layer group of `nucleus_<label>` meshes, so that the
 * label-specific settings (colour maps, filters, selection) apply to it.
 */
export async function loadGltfGroup(url: string): Promise<THREE.Group> {
	const gltf = await new GLTFLoader().loadAsync(url);
	gltf.scene.updateMatrixWorld(true);

	const group = new THREE.Group();
	let unlabelled = 0;

	gltf.scene.traverse((object) => {
		if (!(object as THREE.Mesh).isMesh) return;
		const source = object as THREE.Mesh;

		// Bake node transforms into the geometry so every mesh sits directly in the layer group
		const geometry = source.geometry.clone();
		geometry.applyMatrix4(source.matrixWorld);
		if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
		geometry.computeBoundingSphere();

		// One material per mesh, so colour maps and selection can colour labels individually
		const mesh = new THREE.Mesh(geometry, createNucleusMaterial());
		const label = findLabel(source);
		if (label === undefined) {
			unlabelled++;
			mesh.name = `mesh_${source.name || unlabelled}`;
		} else {
			mesh.name = `${NUCLEUS_PREFIX}${label}`;
		}
		group.add(mesh);
	});

	disposeObject(gltf.scene);

	if (unlabelled > 0) {
		console.warn(`⚠️ ${unlabelled} mesh(es) in ${url} have no extras["${LABEL_KEY}"]; they are shown but not selectable`);
	}
	console.log(`✅ Loaded ${group.children.length} meshes from ${url}`);
	return group;
}
