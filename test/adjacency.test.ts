import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from 'three';
import * as zarrita from 'zarrita';

import { squaredDistanceTransform } from '../src/lib/utils/distanceTransform';
import {
	computeDistanceField, distanceAt, openLabelLevels, parseLabelValues, pickLevel, type DistanceField,
} from '../src/lib/utils/adjacency';
import {
	isSelectable, objectCentres, setHiddenBy, setUnselectableBy,
} from '../src/components/viewer3D/layers/sceneLayers';

const STORE = 'http://store.test/kidney.zarr/';

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const serve = (files: Record<string, Uint8Array | string>) => {
	globalThis.fetch = (async (input: string | URL | Request) => {
		const body = files[String(input instanceof Request ? input.url : input).slice(STORE.length)];
		return body === undefined ? new Response(null, { status: 404 }) : new Response(body as BodyInit);
	}) as typeof fetch;
};

// Deterministic pseudo-random numbers
const random = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const bruteForce = (mask: Uint8Array, [nz, ny, nx]: number[], [sz, sy, sx]: number[]) => {
	const sites: number[][] = [];
	for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
		if (mask[(z * ny + y) * nx + x]) sites.push([z, y, x]);
	}
	const out = new Float32Array(mask.length);
	for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
		out[(z * ny + y) * nx + x] = Math.min(Infinity, ...sites.map(([a, b, c]) =>
			((z - a) * sz) ** 2 + ((y - b) * sy) ** 2 + ((x - c) * sx) ** 2));
	}
	return out;
};

test('distance transform matches brute force, including anisotropic voxels', () => {
	const next = random(7);
	for (const [shape, spacing, density] of [
		[[5, 7, 6], [1, 1, 1], 0.05],
		[[4, 9, 8], [3, 1, 2], 0.02],
		[[1, 12, 10], [1, 4, 4], 0.1],
		[[6, 1, 1], [2, 1, 1], 0.3],
	] as [[number, number, number], [number, number, number], number][]) {
		const mask = Uint8Array.from({ length: shape[0] * shape[1] * shape[2] }, () => (next() < density ? 1 : 0));
		mask[0] = 1;
		const actual = squaredDistanceTransform(mask, shape, spacing);
		const expected = bruteForce(mask, shape, spacing);
		actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-3, `${shape} @${i}: ${value} vs ${expected[i]}`));
	}
	assert.ok(squaredDistanceTransform(new Uint8Array(8), [2, 2, 2]).every((value) => value === Infinity));
});

test('distanceAt maps level-0 coordinates onto a coarser level', () => {
	// Level with scale [1, 4, 4]: voxel (z, y, x) covers level-0 x in [4x, 4x + 4), centred at 4x + 1.5
	const shape: [number, number, number] = [2, 3, 4];
	const scale: [number, number, number] = [1, 4, 4];
	const mask = new Uint8Array(24);
	mask[0] = 1; // structure at level voxel (0, 0, 0) = level-0 centre (x 1.5, y 1.5, z 0)
	const field: DistanceField = { dist2: squaredDistanceTransform(mask, shape, scale), shape, scale, structureVoxels: 1 };

	assert.equal(distanceAt(field, [1.5, 1.5, 0]), 0);
	assert.equal(distanceAt(field, [0, 3, 0]), 0, 'any point inside the structure voxel');
	assert.equal(distanceAt(field, [9.5, 1.5, 0]), 8);
	assert.equal(distanceAt(field, [9.5, 5.5, 1]), Math.sqrt(64 + 16 + 1));
	// Outside the label map: measured from the border voxel
	assert.equal(distanceAt(field, [1.5, 1.5, -3]), 3);
	assert.equal(distanceAt(field, [-8.5, 1.5, 0]), 10);
});

// A (c, z, y, x) label image with micrometre scales, as in kidney.zarr's clusters_* group
const labelImage = (): Record<string, Uint8Array | string> => {
	const level = (path: string, shape: number[], data: Uint16Array) => ({
		[`labels/T/${path}/zarr.json`]: JSON.stringify({
			zarr_format: 3, node_type: 'array', shape, data_type: 'uint16',
			chunk_grid: { name: 'regular', configuration: { chunk_shape: shape } },
			chunk_key_encoding: { name: 'default', configuration: { separator: '/' } },
			fill_value: 0, codecs: [{ name: 'bytes', configuration: { endian: 'little' } }], attributes: {},
		}),
		[`labels/T/${path}/c/0/0/0/0`]: new Uint8Array(data.buffer),
	});
	// Level 0: 1 × 2 × 4 × 4, label 5 at (z0, y0, x0), label 9 at (z1, y3, x3)
	const fine = new Uint16Array(32);
	fine[0] = 5;
	fine[31] = 9;
	return {
		'labels/T/zarr.json': JSON.stringify({
			zarr_format: 3, node_type: 'group',
			attributes: {
				ome: {
					version: '0.5',
					multiscales: [{
						axes: ['c', 'z', 'y', 'x'].map((name) => ({ name })),
						datasets: [
							{ path: 's0', coordinateTransformations: [{ type: 'scale', scale: [1, 0.4, 0.5, 0.5] }] },
							{ path: 's1', coordinateTransformations: [{ type: 'scale', scale: [1, 0.4, 1, 1] }] },
						],
					}],
				},
			},
		}),
		...level('s0', [1, 2, 4, 4], fine),
		...level('s1', [1, 2, 2, 2], Uint16Array.from([5, 0, 0, 0, 0, 0, 0, 9])),
	};
};

test('reads a label image, scales relative to level 0, and limits the structure to label values', async () => {
	serve(labelImage());
	const levels = await openLabelLevels(new zarrita.FetchStore(STORE), 'labels/T');
	assert.deepEqual(levels.map((level) => [level.path, level.shape, level.scale]), [
		['s0', [2, 4, 4], [1, 1, 1]],
		['s1', [2, 2, 2], [1, 2, 2]],
	]);

	const any = await computeDistanceField(levels[0], []);
	assert.equal(any.structureVoxels, 2);
	assert.equal(distanceAt(any, [3, 3, 1]), 0);

	const onlyFive = await computeDistanceField(levels[0], [5]);
	assert.equal(onlyFive.structureVoxels, 1);
	assert.equal(distanceAt(onlyFive, [3, 3, 1]), Math.sqrt(9 + 9 + 1));

	// Level 1 voxel (0, 0, 0) is centred at level-0 (0.5, 0.5, 0)
	const coarse = await computeDistanceField(levels[1], [5]);
	assert.equal(distanceAt(coarse, [0.5, 0.5, 0]), 0);
	assert.equal(distanceAt(coarse, [2.5, 0.5, 0]), 2);
	assert.equal((await computeDistanceField(levels[1], [4])).structureVoxels, 0);
});

test('parses label values and picks a level within the voxel budget', () => {
	assert.deepEqual(parseLabelValues(''), []);
	assert.deepEqual(parseLabelValues(' 3, 7  12;4 '), [3, 7, 12, 4]);
	assert.equal(parseLabelValues('3, x'), null);
	assert.equal(parseLabelValues('0'), null);
	assert.equal(parseLabelValues('1.5'), null);

	const levels = [[559, 512, 512], [559, 256, 256], [559, 128, 128]].map((shape) => ({ shape: shape as [number, number, number] }));
	assert.equal(pickLevel(levels), 2);
	assert.equal(pickLevel(levels, 40_000_000), 1);
	assert.equal(pickLevel(levels, 10), 2, 'falls back to the coarsest');
});

test('visibility and selectability combine the reasons of several controls', () => {
	const mesh = new THREE.Mesh();
	setHiddenBy(mesh, 'filter', true);
	setHiddenBy(mesh, 'adjacency', true);
	setHiddenBy(mesh, 'filter', false);
	assert.equal(mesh.visible, false, 'still hidden by adjacency');
	setHiddenBy(mesh, 'adjacency', false);
	assert.equal(mesh.visible, true);
	assert.equal(mesh.userData.hiddenBy, undefined);

	assert.equal(isSelectable(mesh), true);
	setUnselectableBy(mesh, 'adjacency', true);
	assert.equal(isSelectable(mesh), false);
	assert.equal(mesh.visible, true, 'unselectable meshes stay visible');
	setUnselectableBy(mesh, 'adjacency', false);
	assert.equal(isSelectable(mesh), true);
	setHiddenBy(mesh, 'filter', true);
	assert.equal(isSelectable(mesh), false, 'hidden meshes are not selectable');
});

test('a two-part object has one centre, from its geometry', () => {
	const group = new THREE.Group();
	const part = (x: number) => {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, 0, x + 1, 2, 4], 3));
		const mesh = new THREE.Mesh(geometry);
		mesh.name = 'nucleus_3';
		return mesh;
	};
	group.add(part(10), part(20));
	group.children[1].position.set(100, 0, 0); // an Explode offset is ignored
	assert.deepEqual([...objectCentres(group)].map(([name, centre]) => [name, centre.toArray()]), [['nucleus_3', [15.5, 1, 2]]]);
});
