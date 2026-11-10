import * as zarrita from 'zarrita'

/**
 * Discovery of 3D data sources inside an NGFF store.
 *
 * Plain HTTP stores cannot be listed, so discovery relies on index metadata:
 * - label images: NGFF `labels/zarr.json` with `ome.labels` (v0.5) or `labels` (v0.4)
 * - meshes: `meshes/zarr.json`, a zarr group whose attributes hold
 *   `{"meshes": [{"name": "nuclei", "path": "nuclei.glb", "properties": "nuclei.json"}]}`
 *   (paths relative to `meshes/`). `properties` is optional and holds per-mesh attributes in the
 *   NGFF `image-label.properties` format, keyed by `label-value` = mesh ID; it is either a JSON
 *   file path or, as in `image-label`, the inline array.
 *
 * Both are looked up inside the image group first, then at the store root
 * (bioformats2raw layout). All returned paths are relative to the store root.
 */

export interface MeshIndexEntry {
	name: string
	path: string
	properties?: string | any[]
}

export const joinStorePath = (...parts: string[]) =>
	parts
		.filter(Boolean)
		.join('/')
		.replace(/\/+/g, '/')
		.replace(/^\/|\/$/g, '')

const candidateDirs = (imagePath: string, subdir: string) =>
	[...new Set([joinStorePath(imagePath, subdir), subdir])]

const readGroupAttrs = async (
	store: zarrita.FetchStore,
	path: string
): Promise<Record<string, any> | null> => {
	try {
		const group = await zarrita.open(zarrita.root(store).resolve(path), { kind: 'group' })
		return group.attrs as Record<string, any>
	} catch {
		return null
	}
}

export async function listLabelGroups(store: zarrita.FetchStore, imagePath: string): Promise<string[]> {
	for (const dir of candidateDirs(imagePath, 'labels')) {
		const attrs = await readGroupAttrs(store, dir)
		const names = attrs?.ome?.labels ?? attrs?.labels
		if (Array.isArray(names)) {
			return names.map((name) => joinStorePath(dir, String(name)))
		}
	}
	return []
}

export async function listMeshes(store: zarrita.FetchStore, imagePath: string): Promise<MeshIndexEntry[]> {
	for (const dir of candidateDirs(imagePath, 'meshes')) {
		const attrs = await readGroupAttrs(store, dir)
		const entries = attrs?.ome?.meshes ?? attrs?.meshes
		if (Array.isArray(entries)) {
			return entries
				.filter((entry) => typeof entry?.path === 'string')
				.map((entry) => ({
					name: typeof entry.name === 'string' ? entry.name : entry.path,
					path: joinStorePath(dir, entry.path),
					properties: typeof entry.properties === 'string'
						? joinStorePath(dir, entry.properties)
						: Array.isArray(entry.properties) ? entry.properties : undefined,
				}))
		}
	}
	return []
}

/** Absolute URL of a file inside the store, e.g. a glTF mesh */
export const storeFileUrl = (store: zarrita.FetchStore, path: string) => {
	const base = String(store.url)
	return new URL(path, base.endsWith('/') ? base : `${base}/`).href
}
