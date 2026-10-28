/**
 * Per-label properties of the active 3D layer.
 *
 * External format (NGFF `image-label.properties`, properties.json, mesh property files):
 *   [{ "label-value": 7, "volume": 12.3, ... }, ...]
 * Internally `label-value` is stored as `nucleus_index`.
 *
 * Entries are sparse and sorted by label value: label values can be any 32-bit integer,
 * so the array must not be indexed by label value.
 */

export type LabelProperties = { nucleus_index: number;[key: string]: any };
export type PropertyType = { id: number; name: string; count: number; readOnly: boolean; dimensions?: number[] };

const getDimensions = (arr: any): number[] => {
	if (!Array.isArray(arr)) return [];
	const dims: number[] = [];
	let current = arr;
	while (Array.isArray(current)) {
		dims.push(current.length);
		current = current[0];
	}
	return dims;
};

const createNestedArray = (dims: number[]): any =>
	dims.length === 1
		? Array(dims[0]).fill(0)
		: Array(dims[0]).fill(0).map(() => createNestedArray(dims.slice(1)));

const defaultValue = (type: PropertyType) =>
	type.dimensions ? createNestedArray(type.dimensions) : 0;

const withDefaults = (entry: LabelProperties, types: PropertyType[]) => {
	for (const type of types) {
		if (!(type.name in entry)) entry[type.name] = defaultValue(type);
	}
	return entry;
};

/** Lookup by label value; build once per pass instead of searching the array per mesh */
export const indexByLabel = <T extends { nucleus_index: number }>(entries: T[]) =>
	new Map(entries.map((entry) => [entry.nucleus_index, entry]));

/** Convert the external `label-value` format to internal entries */
export const fromLabelValueFormat = (items: any[]): LabelProperties[] =>
	items
		.map((item) => {
			const { 'label-value': labelValue, ...rest } = item;
			// Fall back to nucleus_index for backward compatibility
			return { ...rest, nucleus_index: Number(labelValue ?? item.nucleus_index) };
		})
		.filter((item) => Number.isFinite(item.nucleus_index));

/** Merge imported properties into the existing ones; imported values win */
export function mergeProperties(
	existing: LabelProperties[],
	existingTypes: PropertyType[],
	imported: LabelProperties[]
): { properties: LabelProperties[]; types: PropertyType[] } {
	const typesByName = new Map(existingTypes.map((type) => [type.name, type]));
	if (imported.length > 0) {
		const sample = imported[0];
		Object.keys(sample).forEach((key) => {
			if (key === 'nucleus_index' || typesByName.has(key)) return;
			const value = sample[key];
			const dimensions = Array.isArray(value) ? getDimensions(value) : [];
			const isMultiDimensional = dimensions.length > 1 || (dimensions.length === 1 && dimensions[0] > 1);
			typesByName.set(key, {
				id: typesByName.size,
				name: key,
				count: 0,
				readOnly: false,
				dimensions: isMultiDimensional ? dimensions : undefined,
			});
		});
	}
	const types = Array.from(typesByName.values());

	const byLabel = new Map(existing.map((entry) => [entry.nucleus_index, entry]));
	for (const item of imported) {
		byLabel.set(item.nucleus_index, { ...byLabel.get(item.nucleus_index), ...item });
	}

	const properties = Array.from(byLabel.values(), (entry) => withDefaults({ ...entry }, types))
		.sort((a, b) => a.nucleus_index - b.nucleus_index);
	return { properties, types };
}

/** Add default entries for labels that have no properties yet (e.g. newly generated meshes) */
export function ensureLabels(
	existing: LabelProperties[],
	types: PropertyType[],
	labels: number[]
): LabelProperties[] {
	const known = new Set(existing.map((entry) => entry.nucleus_index));
	const missing = [...new Set(labels)].filter((label) => !known.has(label));
	if (missing.length === 0) return existing;
	return [...existing, ...missing.map((label) => withDefaults({ nucleus_index: label }, types))]
		.sort((a, b) => a.nucleus_index - b.nucleus_index);
}
