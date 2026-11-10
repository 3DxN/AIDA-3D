import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as zarrita from 'zarrita';

import { listMeshes } from '../src/lib/utils/discoverSources';
import { embeddingRow, formatVector, openEmbeddingSource } from '../src/lib/utils/embeddings';

const STORE = 'http://store.test/kidney.zarr/';
const SHA = '6e077eda234bebc595868d918d3458d9dd32a050199b0ff04443b2f46a0a3b1e';

const group = (attributes: Record<string, unknown>) =>
	JSON.stringify({ zarr_format: 3, node_type: 'group', attributes });

// (3 glyphs, dim 4) float32 array without compressor, chunked by rows; row r holds r*10 + [1.5, 2.5, 3.5, 4.5]
const ROWS = [0, 1, 2].map((r) => Float32Array.from([1.5, 2.5, 3.5, 4.5], (v) => r * 10 + v));
const embeddingArray = (path: string): Record<string, Uint8Array | string> => ({
	[`${path}/zarr.json`]: JSON.stringify({
		zarr_format: 3,
		node_type: 'array',
		shape: [3, 4],
		data_type: 'float32',
		chunk_grid: { name: 'regular', configuration: { chunk_shape: [1, 4] } },
		chunk_key_encoding: { name: 'default', configuration: { separator: '/' } },
		fill_value: 0,
		codecs: [{ name: 'bytes', configuration: { endian: 'little' } }],
		attributes: {},
	}),
	...Object.fromEntries(ROWS.map((row, r) => [`${path}/c/${r}/0`, new Uint8Array(row.buffer)])),
});

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

/** zarrita's FetchStore uses the global fetch; serve in-memory files (keys relative to STORE) and count requests */
const serve = (files: Record<string, Uint8Array | string>) => {
	const requests: string[] = [];
	globalThis.fetch = (async (input: string | URL | Request) => {
		const key = new URL(input instanceof Request ? input.url : String(input)).href.slice(STORE.length);
		requests.push(key);
		const body = files[key];
		return body === undefined ? new Response(null, { status: 404 }) : new Response(body as BodyInit);
	}) as typeof fetch;
	return requests;
};

const meshEntry = {
	name: 'clusters_a',
	path: 'clusters_a.glb',
	properties: 'clusters_a.properties.json',
	embeddings: { path: 'clusters_a.embeddings.zarr', model: 'uni2_h', sha256: SHA, sha256_kind: 'weights_sha256' },
};

test('listMeshes keeps embeddings and resolves their path relative to meshes/', async () => {
	serve({
		'meshes/zarr.json': group({
			meshes: [
				meshEntry,
				{ name: 'plain', path: 'plain.glb' },
				{ name: 'no path', path: 'broken.glb', embeddings: { model: 'uni2_h' } },
			],
		}),
	});
	const meshes = await listMeshes(new zarrita.FetchStore(STORE), '0');

	assert.deepEqual(meshes[0], {
		name: 'clusters_a',
		path: 'meshes/clusters_a.glb',
		properties: 'meshes/clusters_a.properties.json',
		embeddings: { path: 'meshes/clusters_a.embeddings.zarr', model: 'uni2_h', sha256: SHA, sha256_kind: 'weights_sha256' },
	});
	assert.equal(meshes[1].embeddings, undefined, 'missing embeddings means none stored');
	assert.equal(meshes[2].embeddings, undefined, 'embeddings without a path are ignored');
});

test('listMeshes resolves embeddings inside the image group as well', async () => {
	serve({ '0/meshes/zarr.json': group({ meshes: [meshEntry] }) });
	const [mesh] = await listMeshes(new zarrita.FetchStore(STORE), '0');
	assert.equal(mesh.embeddings?.path, '0/meshes/clusters_a.embeddings.zarr');
});

test('label-value n reads row n - 1, fetching only that row', async () => {
	const requests = serve(embeddingArray('meshes/clusters_a.embeddings.zarr'));
	const source = openEmbeddingSource(new zarrita.FetchStore(STORE), {
		path: 'meshes/clusters_a.embeddings.zarr', model: 'uni2_h', sha256: SHA, sha256_kind: 'weights_sha256',
	});

	assert.deepEqual(await source.readRow(1), ROWS[0]);
	assert.deepEqual(await source.readRow(3), ROWS[2]);
	assert.deepEqual(await source.readRow(2), ROWS[1]);
	assert.ok((await source.readRow(1)) instanceof Float32Array);

	const metadataRequests = requests.filter((key) => key.endsWith('embeddings.zarr/zarr.json'));
	assert.equal(metadataRequests.length, 1, 'the array is opened once per source, not per selection');
	assert.deepEqual(
		requests.filter((key) => key.includes('/c/')),
		['meshes/clusters_a.embeddings.zarr/c/0/0', 'meshes/clusters_a.embeddings.zarr/c/2/0',
			'meshes/clusters_a.embeddings.zarr/c/1/0', 'meshes/clusters_a.embeddings.zarr/c/0/0']
	);
	assert.equal(source.model, 'uni2_h');
});

test('rejects label-values without a row, and recovers after a failed open', async () => {
	serve(embeddingArray('e.zarr'));
	const source = openEmbeddingSource(new zarrita.FetchStore(STORE), { path: 'e.zarr' });
	await assert.rejects(source.readRow(4), /label-value 4 has no row in e\.zarr \(3 rows\)/);
	await assert.rejects(source.readRow(0), /integer ≥ 1/);
	assert.throws(() => embeddingRow(1.5), /integer ≥ 1/);
	assert.equal(embeddingRow(7), 6);

	serve({});
	const missing = openEmbeddingSource(new zarrita.FetchStore(STORE), { path: 'missing.zarr' });
	await assert.rejects(missing.readRow(1));
	serve(embeddingArray('missing.zarr'));
	assert.deepEqual(await missing.readRow(1), ROWS[0], 'a later selection retries the open');
});

test('formats the vector as a fixed-width block', () => {
	assert.equal(
		formatVector(Float32Array.from([0.5, -1.25, 10, 0.123456]), 3, 2),
		'0:  0.500 -1.250\n2: 10.000  0.123'
	);
	assert.equal(formatVector([]), '');
});

// A real image store with a raw2features mesh index, e.g.
// AIDA_TEST_STORE=~/servers/oracke/kidney.zarr npm test
const realStore = process.env.AIDA_TEST_STORE;
test('reads embeddings from a real store', { skip: !realStore && 'set AIDA_TEST_STORE to an image store directory' }, async () => {
	const root = pathToFileURL(join(realStore!, '/')).href;
	globalThis.fetch = (async (input: string | URL | Request) => {
		try {
			return new Response(await readFile(fileURLToPath(String(input instanceof Request ? input.url : input))));
		} catch {
			return new Response(null, { status: 404 });
		}
	}) as typeof fetch;

	const store = new zarrita.FetchStore(root);
	const mesh = (await listMeshes(store, '0')).find((entry) => entry.embeddings);
	assert.ok(mesh?.embeddings, 'the store lists a mesh with embeddings');

	const array = await zarrita.open(zarrita.root(store).resolve(mesh.embeddings.path), { kind: 'array' });
	const [, dim] = array.shape;
	const source = openEmbeddingSource(store, mesh.embeddings);
	const first = await source.readRow(1);
	const last = await source.readRow(array.shape[0]);
	assert.equal(first.length, dim);
	assert.equal(last.length, dim);

	// Compare with the raw rows of the full array
	const { data } = await zarrita.get(array, [null, null]);
	assert.deepEqual(first, (data as Float32Array).subarray(0, dim));
	assert.deepEqual(last, (data as Float32Array).subarray((array.shape[0] - 1) * dim));
});
