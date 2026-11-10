import { useEffect, useMemo, useState } from 'react';
import { Disclosure } from '@headlessui/react';
import { PlusIcon, TrashIcon } from '@heroicons/react/solid';

import { useZarrStore } from '../../../lib/contexts/ZarrStoreContext';
import type { SceneLayer } from '../layers/sceneLayers';

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const baseName = (path: string) => path.split('/').pop() || path;

const inputClass =
	'min-w-0 flex-1 p-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500';
const addButtonClass =
	'ml-1 inline-flex items-center p-1 rounded text-gray-600 hover:bg-gray-200 disabled:text-gray-300 disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-teal-500';

/**
 * Picks a label group or a glTF mesh from the store, adds it on top of the scene,
 * lists the loaded layers and clears the scene.
 */
const SourcePicker = (props: {
	label: string;
	options: { value: string; label: string }[];
	placeholder: string;
	disabled: boolean;
	onAdd: (path: string) => void;
}) => {
	const { label, options, placeholder, disabled, onAdd } = props;
	const [value, setValue] = useState('');

	useEffect(() => {
		setValue(options[0]?.value ?? '');
	}, [options]);

	return (
		<div className="px-4 py-1">
			<label className="block mb-1 text-xs font-medium text-gray-700">{label}</label>
			<div className="flex items-center">
				{options.length > 0 ? (
					<select value={value} onChange={(e) => setValue(e.target.value)} className={inputClass}>
						{options.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				) : (
					// No index found in the store: let the user type a path relative to the store root
					<input
						type="text"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						placeholder={placeholder}
						className={inputClass}
					/>
				)}
				<button
					type="button"
					className={addButtonClass}
					disabled={disabled || !value.trim()}
					onClick={() => onAdd(value.trim())}
					title="Add to scene"
				>
					<PlusIcon className="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
};

export default function Sources(props: {
	layers: SceneLayer[];
	layerError: string | null;
	isLoading: boolean;
	onAddLabels: (path: string) => void;
	onAddMesh: (path: string) => void;
	onClear: () => void;
}) {
	const { layers, layerError, isLoading, onAddLabels, onAddMesh, onClear } = props;
	const { availableLabelGroups, availableMeshes, isCellposeLoading, cellposeError } = useZarrStore();

	const [confirmClear, setConfirmClear] = useState(false);

	// Clearing needs a second click within a few seconds
	useEffect(() => {
		if (!confirmClear) return;
		const timeout = setTimeout(() => setConfirmClear(false), 4000);
		return () => clearTimeout(timeout);
	}, [confirmClear]);

	const labelOptions = useMemo(
		() => availableLabelGroups.map((path) => ({ value: path, label: baseName(path) })),
		[availableLabelGroups]
	);
	const meshOptions = useMemo(
		() => availableMeshes.map((mesh) => ({ value: mesh.path, label: mesh.name })),
		[availableMeshes]
	);
	const busy = isLoading || isCellposeLoading;
	const error = layerError || cellposeError;

	return (
		<Disclosure className="shadow-sm" as="div" defaultOpen>
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
						3D Data
					</Disclosure.Button>
					<Disclosure.Panel className="pb-2">
						<SourcePicker
							label="Label image"
							options={labelOptions}
							placeholder="labels/Cellpose"
							disabled={busy}
							onAdd={onAddLabels}
						/>
						<SourcePicker
							label="Mesh (glTF)"
							options={meshOptions}
							placeholder="meshes/nuclei.glb"
							disabled={busy}
							onAdd={onAddMesh}
						/>

						{error && <p className="px-4 pt-1 text-xs text-red-600 break-words">{error}</p>}

						{layers.length > 0 && (
							<ul className="px-4 pt-2 space-y-1">
								{layers.map((layer, index) => {
									const isActive = index === layers.length - 1;
									return (
										<li key={layer.id} className="flex items-center justify-between text-xs" title={layer.sourcePath}>
											<span className="truncate">
												<span className="text-gray-400">{layer.kind === 'labels' ? 'Labels' : 'Mesh'} · </span>
												{baseName(layer.sourcePath)}
											</span>
											<span
												className={classNames(
													'ml-2 shrink-0 rounded px-1',
													isActive ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
												)}
											>
												{isActive ? 'active' : 'static'}
											</span>
										</li>
									);
								})}
							</ul>
						)}

						<div className="px-4 pt-2 flex items-center">
							<button
								type="button"
								disabled={layers.length === 0}
								onClick={() => {
									if (confirmClear) {
										setConfirmClear(false);
										onClear();
									} else {
										setConfirmClear(true);
									}
								}}
								className={classNames(
									'inline-flex items-center px-2 py-1 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:text-gray-300 disabled:hover:bg-transparent',
									confirmClear ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 hover:bg-red-50'
								)}
							>
								<TrashIcon className="h-4 w-4 mr-1" aria-hidden="true" />
								{confirmClear ? 'Click again to clear' : 'Clear 3D scene'}
							</button>
							{confirmClear && (
								<button
									type="button"
									onClick={() => setConfirmClear(false)}
									className="ml-2 text-xs text-gray-500 hover:text-gray-700"
								>
									Cancel
								</button>
							)}
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
}
