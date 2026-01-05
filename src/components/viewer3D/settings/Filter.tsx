// src/components/viewer3D/settings/Filter.tsx

import { Fragment, useState, useEffect, useCallback } from 'react';
import { Disclosure, Listbox, Transition } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';
import { Camera, Scene, WebGLRenderer, Group, Mesh } from 'three';

import RangeSlider from '../../interaction/RangeSlider';

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const Filter = (props: {
	content: Group;
	renderer: WebGLRenderer;
	scene: Scene;
	camera: Camera;
	featureData: any;
	selected: Mesh[];
	globalProperties: React.MutableRefObject<{ nucleus_index: number;[key: string]: any }[]>;
	globalPropertyTypes: React.MutableRefObject<{ id: number; name: string; count: number; readOnly: boolean, dimensions?: number[] }[]>;
	transientProperties?: React.MutableRefObject<Map<number, Record<string, any>>>;
	transientPropertyTypes?: React.MutableRefObject<{ name: string; isTransient: boolean }[]>;
	filterIncompleteNuclei: boolean;
	setFilterIncompleteNuclei: (value: boolean) => void;
}) => {
	const { content, scene, camera, renderer, featureData, selected, globalProperties, globalPropertyTypes, transientProperties, transientPropertyTypes, filterIncompleteNuclei, setFilterIncompleteNuclei } = props;

	const [featureMap, setFeatureMap] = useState<{ name: string, value: string, isTransient: boolean } | null>(null);
	const [storedFeatures, setStoredFeatures] = useState<{ name: string, value: string, isTransient: boolean }[]>([]);
	const [transientFeaturesArr, setTransientFeaturesArr] = useState<{ name: string, value: string, isTransient: boolean }[]>([]);
	const [min, setMin] = useState(0);
	const [max, setMax] = useState(1);
	const [values, setValues] = useState([0, 0]);

	// When new property types are available, update the list of features.
	useEffect(() => {
		let stored: { name: string, value: string, isTransient: boolean }[] = [];
		let transient: { name: string, value: string, isTransient: boolean }[] = [];

		if (globalPropertyTypes && globalPropertyTypes.current) {
			stored = globalPropertyTypes.current
				.filter(attr => !attr.dimensions) // Filter out multi-dimensional properties for the slider
				.map(attr => ({ name: attr.name, value: attr.name, isTransient: false }));
			setStoredFeatures(stored);
		}

		if (transientPropertyTypes && transientPropertyTypes.current) {
			transient = transientPropertyTypes.current.map(tp => ({
				name: tp.name,
				value: tp.name,
				isTransient: true
			}));
			setTransientFeaturesArr(transient);
		}

		const allFeatures = [...stored, ...transient];
		// If there's no feature selected, or the selected one is no longer valid, select the first one.
		if (!featureMap || !allFeatures.some(f => f.value === featureMap.value)) {
			setFeatureMap(allFeatures.length > 0 ? allFeatures[0] : null);
		}
		// Rerun this effect when featureData changes, as this indicates properties may have changed.
	}, [featureData, globalPropertyTypes, transientPropertyTypes, featureMap]);

	const onValuesUpdate = useCallback(
		(rangeValues) => {
			if (content && featureData && featureMap) {
				const { value: propertyName, isTransient } = featureMap;

				content.children.forEach((child) => {
					if (child.isMesh && child.name.includes('nucleus')) {
						const nucleus = child as Mesh;
						const nucleusIndex = parseInt(child.name.split('_')[1], 10);

						let value: number | undefined;
						if (isTransient && transientProperties) {
							value = transientProperties.current.get(nucleusIndex)?.[propertyName];
						} else if (globalProperties.current) {
							const nucleusData = globalProperties.current.find(p => p.nucleus_index === nucleusIndex);
							value = nucleusData ? nucleusData[propertyName] : undefined;
						}

						if (typeof value === 'number') {
							nucleus.visible = value >= rangeValues[0] && value <= rangeValues[1];
						} else {
							nucleus.visible = true; // Show if no value
						}
					}
				});

				renderer.render(scene, camera);
			}
		},
		[renderer, content, featureMap, camera, scene, featureData, globalProperties, transientProperties]
	);


	// Show only selected meshes
	const onSelectedShow = useCallback(() => {
		if (content) {
			content.children.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child as Mesh;
					nucleus.visible = false;
				}
			});

			selected.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child as Mesh;
					nucleus.visible = true;
				}
			});

			renderer.render(scene, camera);
		}
	}, [content, renderer, scene, camera, selected]);

	// Hide selected meshes
	const onSelectedHide = useCallback(() => {
		if (content) {
			selected.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child as Mesh;
					nucleus.visible = false;
				}
			});

			renderer.render(scene, camera);
		}
	}, [content, renderer, scene, camera, selected]);

	// Reset all meshes to visible
	const onReset = useCallback(() => {
		if (content) {
			content.children.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child as Mesh;
					(nucleus.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
					nucleus.visible = true;
				}
			});
			renderer.render(scene, camera);
		}

		// Reset slider values to min max by forcing a re-render of the component with a new key
		if (featureMap) {
			setFeatureMap(JSON.parse(JSON.stringify(featureMap)));
		}
	}, [content, renderer, scene, camera, featureMap]);

	// Set slider min/max based on the selected property
	useEffect(() => {
		if (featureData && content && featureMap) {
			const { value: propertyName, isTransient } = featureMap;

			let propertyValues: number[] = [];
			if (isTransient && transientProperties) {
				propertyValues = Array.from(transientProperties.current.values())
					.map(props => props[propertyName])
					.filter((val): val is number => typeof val === 'number');
			} else if (globalProperties.current) {
				propertyValues = globalProperties.current
					.map(attr => attr[propertyName])
					.filter((val): val is number => typeof val === 'number');
			}

			if (propertyValues.length > 0) {
				const mapMax = propertyValues.reduce((a, b) => Math.max(a, b), -Infinity);
				const mapMin = propertyValues.reduce((a, b) => Math.min(a, b), Infinity);

				setMax(mapMax);
				setMin(mapMin);
				setValues([mapMin, mapMax]);
			}
		}
	}, [featureMap, featureData, content, globalProperties, transientProperties]);

	return (
		<Disclosure className="shadow-sm" as="div">
			{({ open }) => (
				<>
					<Disclosure.Button
						className={classNames(
							'text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
						)}
					>
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
						Filter
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						{/* Filter incomplete nuclei toggle */}
						<div className="mb-4">
							<label className="flex items-center space-x-2 cursor-pointer">
								<input
									type="checkbox"
									checked={filterIncompleteNuclei}
									onChange={(e) => setFilterIncompleteNuclei(e.target.checked)}
									className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
								/>
								<span className="text-sm font-medium text-gray-700">
									Filter incomplete nuclei
								</span>
							</label>
						</div>

						{/* Change feature map */}
						{featureMap && (
							<Listbox value={featureMap} onChange={setFeatureMap}>
								{({ open }) => (
									<>
										<Listbox.Label className="block text-sm font-medium text-gray-700">
											By property
										</Listbox.Label>
										<div className="mt-1 relative">
											<Listbox.Button className="bg-white relative w-full border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
												<span className="block truncate">{featureMap.name}</span>
												<span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
													<SelectorIcon
														className="h-5 w-5 text-gray-400"
														aria-hidden="true"
													/>
												</span>
											</Listbox.Button>

											<Transition
												show={open}
												as={Fragment}
												leave="transition ease-in duration-100"
												leaveFrom="opacity-100"
												leaveTo="opacity-0"
											>
												<Listbox.Options
													className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
												>
													{/* Stored properties section */}
													{storedFeatures.length > 0 && (
														<>
															<div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
																Stored
															</div>
															{storedFeatures.map((setting) => (
																<Listbox.Option
																	key={`stored-${setting.value}`}
																	className={({ active }) =>
																		classNames(
																			active
																				? 'text-white bg-teal-600'
																				: 'text-gray-900',
																			'cursor-default select-none relative py-2 pl-3 pr-9'
																		)
																	}
																	value={setting}
																>
																	{({ selected, active }) => (
																		<>
																			<span
																				className={classNames(
																					selected ? 'font-semibold' : 'font-normal',
																					'block truncate'
																				)}
																			>
																				{setting.name}
																			</span>

																			{selected ? (
																				<span
																					className={classNames(
																						active ? 'text-white' : 'text-teal-600',
																						'absolute inset-y-0 right-0 flex items-center pr-4'
																					)}
																				>
																					<CheckIcon
																						className="h-5 w-5"
																						aria-hidden="true"
																					/>
																				</span>
																			) : null}
																		</>
																	)}
																</Listbox.Option>
															))}
														</>
													)}

													{/* Transient properties section */}
													{transientFeaturesArr.length > 0 && (
														<>
															<div className={classNames(
																storedFeatures.length > 0 ? 'border-t border-gray-200' : '',
																'px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50'
															)}>
																Transient
															</div>
															{transientFeaturesArr.map((setting) => (
																<Listbox.Option
																	key={`transient-${setting.value}`}
																	className={({ active }) =>
																		classNames(
																			active
																				? 'text-white bg-teal-600'
																				: 'text-gray-900',
																			'cursor-default select-none relative py-2 pl-3 pr-9'
																		)
																	}
																	value={setting}
																>
																	{({ selected, active }) => (
																		<>
																			<span
																				className={classNames(
																					selected ? 'font-semibold' : 'font-normal',
																					'block truncate'
																				)}
																			>
																				{setting.name}
																			</span>

																			{selected ? (
																				<span
																					className={classNames(
																						active ? 'text-white' : 'text-teal-600',
																						'absolute inset-y-0 right-0 flex items-center pr-4'
																					)}
																				>
																					<CheckIcon
																						className="h-5 w-5"
																						aria-hidden="true"
																					/>
																				</span>
																			) : null}
																		</>
																	)}
																</Listbox.Option>
															))}
														</>
													)}
												</Listbox.Options>
											</Transition>
										</div>
									</>
								)}
							</Listbox>
						)}


						{/* Range slider */}
						{featureMap && (
							<div className="mt-4 flex items-center ">
								<div className="text-sm">{values[0].toPrecision(2)}</div>
								<RangeSlider
									key={featureMap.value}
									minValue={min}
									maxValue={max}
									defaultValue={[min, max]}
									step={(max - min) / 100 || 0.01}
									aria-label="adjust filter range"
									onValuesUpdate={onValuesUpdate}
								/>
								<div className="text-sm">{values[1].toPrecision(2)}</div>
							</div>
						)}


						{/* By selection */}
						<div className="block text-sm font-medium text-gray-700 mt-4">
							By selection
						</div>

						<span className="relative z-0 inline-flex shadow-sm rounded-md mt-1">
							<button
								type="button"
								className="relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
								onClick={() => {
									onSelectedShow();
								}}
							>
								Show
							</button>
							<button
								type="button"
								className="-ml-px relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
								onClick={() => {
									onSelectedHide();
								}}
							>
								Hide
							</button>
						</span>

						<button
							type="button"
							className="mt-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
							onClick={() => {
								onReset();
							}}
						>
							Reset
						</button>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
};

export default Filter;