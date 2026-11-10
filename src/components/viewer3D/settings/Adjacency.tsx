import { useEffect, useMemo, useRef, useState } from 'react';
import { Disclosure } from '@headlessui/react';
import { Camera, Scene, WebGLRenderer, Group } from 'three';

import Switch from '../../interaction/Switch';
import { useZarrStore } from '../../../lib/contexts/ZarrStoreContext';
import { useNucleusSelection } from '../../../lib/contexts/NucleusSelectionContext';
import {
	type DistanceField, type LabelLevel,
	computeDistanceField, distanceAt, openLabelLevels, parseLabelValues, pickLevel, voxelCount,
} from '../../../lib/utils/adjacency';
import { nucleusMeshes, objectCentres, setHiddenBy, setUnselectableBy } from '../layers/sceneLayers';

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const ADJACENCY = 'adjacency';
// Finer levels need too much memory for the distance field (4 bytes per voxel plus the label data)
const MAX_VOXELS = 64_000_000;

const inputClass =
	'w-full p-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500';

type FieldState =
	| { status: 'idle' }
	| { status: 'loading'; message: string }
	| { status: 'ready'; field: DistanceField }
	| { status: 'error'; message: string };

/**
 * Restricts the active layer to objects near (or far from) a reference label map, e.g. a tissue
 * segmentation: the others can be hidden and/or made unselectable, to pick objects in a cluttered scene.
 */
export default function Adjacency(props: {
	renderer: WebGLRenderer;
	scene: Scene;
	camera: Camera;
	content: Group | null;
}) {
	const { renderer, scene, camera, content } = props;
	const { store, availableLabelGroups } = useZarrStore();
	const { selectedNucleiIndices, setSelectedNucleiIndices } = useNucleusSelection();

	const [enabled, setEnabled] = useState(false);
	const [reference, setReference] = useState('');
	const [labelsText, setLabelsText] = useState('');
	const [levels, setLevels] = useState<LabelLevel[] | null>(null);
	const [levelIndex, setLevelIndex] = useState(0);
	const [fieldState, setFieldState] = useState<FieldState>({ status: 'idle' });
	const [distance, setDistance] = useState(20);
	const [mode, setMode] = useState<'near' | 'far'>('near');
	const [hideOthers, setHideOthers] = useState(true);
	const [lockOthers, setLockOthers] = useState(true);

	// Opened label images and computed distance fields, reused when switching back and forth
	const levelCache = useRef(new Map<string, Promise<LabelLevel[]>>());
	const fieldCache = useRef(new Map<string, DistanceField>());

	useEffect(() => {
		if (!reference && availableLabelGroups.length > 0) setReference(availableLabelGroups[0]);
	}, [availableLabelGroups, reference]);

	const labelValues = useMemo(() => parseLabelValues(labelsText), [labelsText]);

	// Open the reference label image
	useEffect(() => {
		if (!enabled || !store || !reference) return;
		let cancelled = false;
		setLevels(null);
		setFieldState({ status: 'loading', message: 'Opening label image…' });

		let opening = levelCache.current.get(reference);
		if (!opening) {
			opening = openLabelLevels(store, reference);
			levelCache.current.set(reference, opening);
		}
		opening.then(
			(opened) => {
				if (cancelled) return;
				setLevels(opened);
				setLevelIndex(pickLevel(opened));
			},
			(error) => {
				levelCache.current.delete(reference);
				if (!cancelled) setFieldState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
			}
		);
		return () => {
			cancelled = true;
		};
	}, [enabled, store, reference]);

	// Compute the distance field for the chosen level and label values
	useEffect(() => {
		const level = levels?.[levelIndex];
		if (!enabled || !level || labelValues === null) return;
		const key = `${reference}|${level.path}|${labelValues.join(',')}`;
		const cached = fieldCache.current.get(key);
		if (cached) {
			setFieldState({ status: 'ready', field: cached });
			return;
		}

		let cancelled = false;
		setFieldState({ status: 'loading', message: `Computing distances at level ${level.path}…` });
		(async () => {
			try {
				// Let the status render before the computation blocks the page
				await new Promise((resolve) => setTimeout(resolve, 0));
				const start = performance.now();
				const field = await computeDistanceField(level, labelValues);
				console.log(`📏 Distance field for ${reference} level ${level.path} (${level.shape.join(' × ')}): ${(performance.now() - start).toFixed(0)}ms, ${field.structureVoxels} structure voxels`);
				if (field.structureVoxels === 0) {
					throw new Error(labelValues.length > 0
						? `No voxels with label ${labelValues.join(', ')} in ${reference}`
						: `${reference} contains no labelled voxels`);
				}
				fieldCache.current.set(key, field);
				if (!cancelled) setFieldState({ status: 'ready', field });
			} catch (error) {
				console.error('❌ Adjacency:', error);
				if (!cancelled) setFieldState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [enabled, reference, levels, levelIndex, labelValues]);

	const field = enabled && fieldState.status === 'ready' ? fieldState.field : null;

	// Distance of each object of the active layer to the structure
	const distances = useMemo(() => {
		if (!field || !content) return null;
		const result = new Map<string, number>();
		objectCentres(content).forEach((centre, name) => result.set(name, distanceAt(field, [centre.x, centre.y, centre.z])));
		return result;
	}, [field, content]);

	// An empty or negative distance applies nothing (rather than hiding everything)
	const threshold = Number.isFinite(distance) && distance >= 0 ? distance : null;

	// Objects that pass the threshold
	const passing = useMemo(() => {
		if (!distances || threshold === null) return null;
		const result = new Set<string>();
		distances.forEach((value, name) => {
			if (mode === 'near' ? value <= threshold : value > threshold) result.add(name);
		});
		return result;
	}, [distances, threshold, mode]);

	// Apply to the active layer; cleared again when switched off or when the layer changes
	useEffect(() => {
		if (!content || !passing) return;
		const meshes = nucleusMeshes(content);
		meshes.forEach((mesh) => {
			const outside = !passing.has(mesh.name);
			setHiddenBy(mesh, ADJACENCY, hideOthers && outside);
			setUnselectableBy(mesh, ADJACENCY, lockOthers && outside);
		});
		renderer?.render(scene, camera);
		return () => {
			meshes.forEach((mesh) => {
				setHiddenBy(mesh, ADJACENCY, false);
				setUnselectableBy(mesh, ADJACENCY, false);
			});
			renderer?.render(scene, camera);
		};
	}, [content, passing, hideOthers, lockOthers, renderer, scene, camera]);

	// Objects that can no longer be selected leave the selection
	useEffect(() => {
		if (!passing || !(hideOthers || lockOthers)) return;
		const kept = selectedNucleiIndices.filter((index) => passing.has(`nucleus_${index}`));
		if (kept.length !== selectedNucleiIndices.length) setSelectedNucleiIndices(kept);
	}, [passing, hideOthers, lockOthers, selectedNucleiIndices, setSelectedNucleiIndices]);

	const level = levels?.[levelIndex];

	return (
		<Disclosure className="shadow-sm" as="div">
			{({ open }) => (
				<>
					<Disclosure.Button className="text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset">
						<svg
							className={classNames(
								open ? 'text-gray-400 rotate-90' : 'text-gray-300',
								'mr-2 shrink-0 h-5 w-5 group-hover:text-gray-400 transition-colors ease-in-out duration-150'
							)}
							viewBox="0 0 20 20"
							aria-hidden="true"
						>
							<path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
						</svg>
						Adjacency
					</Disclosure.Button>
					<Disclosure.Panel className="px-4 py-2 space-y-2 text-xs">
						<div className="flex items-center justify-between">
							<span>Filter by distance to a label map</span>
							<Switch enabled={enabled} onChange={setEnabled} />
						</div>

						<label className="block">
							<span className="block mb-1 font-medium text-gray-700">Reference label map</span>
							{availableLabelGroups.length > 0 ? (
								<select value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass}>
									{availableLabelGroups.map((path) => (
										<option key={path} value={path}>{path.split('/').pop()}</option>
									))}
								</select>
							) : (
								<input
									type="text"
									value={reference}
									onChange={(e) => setReference(e.target.value.trim())}
									placeholder="labels/Tubulus"
									className={inputClass}
								/>
							)}
						</label>

						<label className="block">
							<span className="block mb-1 font-medium text-gray-700">Label values</span>
							<input
								type="text"
								value={labelsText}
								onChange={(e) => setLabelsText(e.target.value)}
								placeholder="any (e.g. 3, 7)"
								className={classNames(inputClass, labelValues === null && 'border-red-500')}
							/>
							{labelValues === null && <span className="text-red-600">Enter positive whole numbers</span>}
						</label>

						{levels && (
							<label className="block">
								<span className="block mb-1 font-medium text-gray-700">Resolution level</span>
								<select
									value={levelIndex}
									onChange={(e) => setLevelIndex(Number(e.target.value))}
									className={inputClass}
								>
									{levels.map((option, index) => (
										<option key={option.path} value={index} disabled={voxelCount(option) > MAX_VOXELS}>
											{option.path}: {option.shape.join('×')}
											{voxelCount(option) > MAX_VOXELS ? ' (too large)' : ''}
										</option>
									))}
								</select>
								{level && (
									<span className="text-gray-500">
										Distances accurate to about ±{Math.max(...level.scale) / 2} voxels
									</span>
								)}
							</label>
						)}

						<div className="flex items-center gap-2">
							<select
								value={mode}
								onChange={(e) => setMode(e.target.value as 'near' | 'far')}
								className="p-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
								aria-label="Keep objects near or far"
							>
								<option value="near">within</option>
								<option value="far">farther than</option>
							</select>
							<input
								type="number"
								min={0}
								value={Number.isFinite(distance) ? distance : ''}
								onChange={(e) => setDistance(e.target.value === '' ? NaN : Number(e.target.value))}
								aria-label="Distance in level-0 voxels"
								className={classNames(
									'w-20 p-1 border rounded bg-white focus:outline-none focus:ring-2 focus:ring-teal-500',
									threshold === null ? 'border-red-500' : 'border-gray-300'
								)}
							/>
							<span className="text-gray-500">voxels</span>
						</div>

						<div className="flex items-center justify-between">
							<span>Hide the others</span>
							<Switch enabled={hideOthers} onChange={setHideOthers} />
						</div>
						<div className="flex items-center justify-between">
							<span>Make the others unselectable</span>
							<Switch enabled={lockOthers} onChange={setLockOthers} />
						</div>

						{enabled && fieldState.status === 'loading' && <p className="text-gray-500">{fieldState.message}</p>}
						{enabled && fieldState.status === 'error' && <p className="text-red-600 break-words">{fieldState.message}</p>}
						{enabled && passing && distances && (
							<p className="text-gray-600">
								{passing.size} of {distances.size} objects {mode === 'near' ? 'within' : 'farther than'} {distance} voxels
							</p>
						)}
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
}
