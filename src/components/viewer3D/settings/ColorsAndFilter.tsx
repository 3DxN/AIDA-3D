// src/components/viewer3D/settings/ColorsAndFilter.tsx

import { Fragment, useState, useEffect, useCallback } from 'react';
import { Disclosure, Listbox, Switch, Transition } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';
import * as THREE from 'three';
// @ts-ignore
import * as d3 from 'd3';

import RangeSlider from '../../interaction/RangeSlider';
import { useNucleusColor } from '../../../lib/contexts/NucleusColorContext';

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ');
}

function normalize(min: number, max: number) {
	const delta = max - min;
	if (delta === 0) {
		return () => 0.5;
	}
	return (val: number) => (val - min) / delta;
}

const colorScales = [
	{ name: 'Brown to teal-green', value: d3.interpolateBrBG },
	{ name: 'Purple to green', value: d3.interpolatePRGn },
	{ name: 'Red to blue', value: d3.interpolateRdBu },
	{ name: 'Spectral', value: d3.interpolateSpectral },
	{ name: 'Blues', value: d3.interpolateBlues },
	{ name: 'Greens', value: d3.interpolateGreens },
	{ name: 'Reds', value: d3.interpolateReds },
	{ name: 'Greys', value: d3.interpolateGreys },
	{ name: 'Purples', value: d3.interpolatePurples },
	{ name: 'Oranges', value: d3.interpolateOranges },
	{
		name: 'Binary yellow',
		value: (value: number) => {
			if (value > 0.5) return 'rgb(255,247,0)';
			else return 'rgb(255,255,247)';
		},
	},
	{
		name: 'Binary red',
		value: (value: number) => {
			if (value > 0.5) return 'rgb(255,0,0)';
			else return 'rgb(255,247,247)';
		},
	},
];

const getFeatureDisplayName = (name: string): string => {
	const displayNames: Record<string, string> = {
		'elongation': 'Elongation',
		'flatness': 'Flatness',
		'sphericity': 'Sphericity',
		'volume': 'Volume',
		'diameter': 'Diameter',
		'nucleusVolume': 'Volume',
		'nucleusDiameter': 'Diameter',
	};
	return displayNames[name] || name;
};

const ColorsAndFilter = (props: {
	content: THREE.Group;
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camera: THREE.Camera;
	featureData: any;
	selected: THREE.Mesh[];
	globalPropertyTypes: React.MutableRefObject<
		{ id: number; name: string; count: number; readOnly: boolean; dimensions?: number[] }[]
	>;
	globalProperties: React.MutableRefObject<
		{ nucleus_index: number; [key: string]: any }[]
	>;
	transientProperties?: React.MutableRefObject<Map<number, Record<string, any>>>;
	transientPropertyTypes?: React.MutableRefObject<{ name: string; isTransient: boolean }[]>;
	filterIncompleteNuclei: boolean;
	setFilterIncompleteNuclei: (value: boolean) => void;
}) => {
	const {
		content,
		scene,
		camera,
		renderer,
		featureData,
		selected,
		globalPropertyTypes,
		globalProperties,
		transientProperties,
		transientPropertyTypes,
		filterIncompleteNuclei,
		setFilterIncompleteNuclei,
	} = props;

	const { updateNucleusColors } = useNucleusColor();

	// Single property selection for both coloring and filtering
	const [featureMap, setFeatureMap] = useState<{ name: string; value: string; isTransient: boolean } | null>(null);
	const [storedFeatures, setStoredFeatures] = useState<{ name: string; value: string; isTransient: boolean }[]>([]);
	const [transientFeatures, setTransientFeatures] = useState<{ name: string; value: string; isTransient: boolean }[]>([]);

	// Color settings
	const [colorScale, setColorScale] = useState(colorScales[3]); // Spectral default
	const [normalise, setNormalise] = useState(true);

	// Filter range settings
	const [min, setMin] = useState(0);
	const [max, setMax] = useState(1);
	const [values, setValues] = useState([0, 1]);
	const [resetToMinMax, setResetToMinMax] = useState<[number, number] | null>(null);

	// Build feature lists from property types
	useEffect(() => {
		let stored: { name: string; value: string; isTransient: boolean }[] = [];
		let transient: { name: string; value: string; isTransient: boolean }[] = [];

		if (globalPropertyTypes && globalPropertyTypes.current) {
			stored = globalPropertyTypes.current
				.filter((attr) => !attr.dimensions)
				.map((attr) => ({ name: getFeatureDisplayName(attr.name), value: attr.name, isTransient: false }));
			setStoredFeatures(stored);
		}

		if (transientPropertyTypes && transientPropertyTypes.current) {
			transient = transientPropertyTypes.current.map((tp) => ({
				name: getFeatureDisplayName(tp.name),
				value: tp.name,
				isTransient: true,
			}));
			setTransientFeatures(transient);
		}

		const allFeatures = [...stored, ...transient];
		if (!featureMap || !allFeatures.some((f) => f.value === featureMap.value)) {
			setFeatureMap(allFeatures.length > 0 ? allFeatures[0] : null);
		}
	}, [featureData, globalPropertyTypes, transientPropertyTypes, featureMap]);

	// Get value for a nucleus
	const getValue = useCallback(
		(nucleusIndex: number) => {
			if (!featureMap) return undefined;
			const { value: propertyName, isTransient } = featureMap;

			if (isTransient && transientProperties) {
				return transientProperties.current.get(nucleusIndex)?.[propertyName];
			}
			const nucleusData = globalProperties.current.find((l) => l.nucleus_index === nucleusIndex);
			return nucleusData ? nucleusData[propertyName] : undefined;
		},
		[featureMap, globalProperties, transientProperties]
	);

	// Update slider min/max when property changes
	useEffect(() => {
		if (featureData && content && featureMap) {
			const { value: propertyName, isTransient } = featureMap;

			let propertyValues: number[] = [];
			if (isTransient && transientProperties) {
				propertyValues = Array.from(transientProperties.current.values())
					.map((props) => props[propertyName])
					.filter((val): val is number => typeof val === 'number');
			} else if (globalProperties.current) {
				propertyValues = globalProperties.current
					.map((attr) => attr[propertyName])
					.filter((val): val is number => typeof val === 'number');
			}

			if (propertyValues.length > 0) {
				const mapMax = propertyValues.reduce((a, b) => Math.max(a, b), -Infinity);
				const mapMin = propertyValues.reduce((a, b) => Math.min(a, b), Infinity);

				setMax(mapMax);
				setMin(mapMin);
				setValues([mapMin, mapMax]);
				setResetToMinMax([mapMin, mapMax]);
			}
		}
	}, [featureMap, featureData, content, globalProperties, transientProperties]);

	// Update colors when property, color scale, or normalise changes
	useEffect(() => {
		if (!content || !renderer || !scene || !camera || !globalProperties.current) {
			return;
		}

		const colorMap = new Map<number, THREE.Color>();

		if (!featureMap || !featureMap.value) {
			// Reset to default grey
			content.children.forEach((child) => {
				if ((child as any).isMesh && child.name.includes('nucleus')) {
					const nucleus = child as THREE.Mesh;
					const material = nucleus.material as THREE.MeshStandardMaterial;
					const nucleusIndex = parseInt(child.name.split('_')[1], 10);
					material.color.set(0x808080);
					colorMap.set(nucleusIndex, material.color.clone());
				}
			});
			updateNucleusColors(colorMap);
			renderer.render(scene, camera);
			return;
		}

		const visibleIndices = new Set(
			content.children
				.filter((child) => child.name.includes('nucleus'))
				.map((child) => parseInt(child.name.split('_')[1], 10))
		);

		const allValues = Array.from(visibleIndices)
			.map((idx) => getValue(idx))
			.filter((v): v is number => typeof v === 'number' && v > 0);

		if (allValues.length === 0) {
			updateNucleusColors(colorMap);
			renderer.render(scene, camera);
			return;
		}

		const mapMin = allValues.reduce((a, b) => Math.min(a, b), Infinity);
		const mapMax = allValues.reduce((a, b) => Math.max(a, b), -Infinity);

		content.children.forEach((child) => {
			if ((child as any).isMesh && child.name.includes('nucleus')) {
				const nucleus = child as THREE.Mesh;
				const material = nucleus.material as THREE.MeshStandardMaterial;
				const nucleusIndex = parseInt(child.name.split('_')[1], 10);

				const value = getValue(nucleusIndex);

				if (typeof value !== 'number') {
					material.color.set(0x808080);
					colorMap.set(nucleusIndex, material.color.clone());
					return;
				}

				const normalizedValue = normalise ? normalize(mapMin, mapMax)(value) : value;
				const colorString = colorScale.value(normalizedValue);

				material.color.set(new THREE.Color(colorString));
				colorMap.set(nucleusIndex, material.color.clone());
			}
		});

		updateNucleusColors(colorMap);
		renderer.render(scene, camera);
	}, [featureMap, colorScale, normalise, globalProperties, content, renderer, scene, camera, updateNucleusColors, transientProperties, getValue]);

	// Filter by range
	const onValuesUpdate = useCallback(
		(rangeValues: number[]) => {
			if (content && featureData && featureMap) {
				content.children.forEach((child) => {
					if ((child as any).isMesh && child.name.includes('nucleus')) {
						const nucleus = child as THREE.Mesh;
						const nucleusIndex = parseInt(child.name.split('_')[1], 10);
						const value = getValue(nucleusIndex);

						if (typeof value === 'number') {
							nucleus.visible = value >= rangeValues[0] && value <= rangeValues[1];
						} else {
							nucleus.visible = true;
						}
					}
				});

				renderer.render(scene, camera);
			}
		},
		[renderer, content, featureMap, camera, scene, featureData, getValue]
	);

	// Show only selected
	const onSelectedShow = useCallback(() => {
		if (content) {
			content.children.forEach((child) => {
				if ((child as any).isMesh && child.name.includes('nucleus')) {
					(child as THREE.Mesh).visible = false;
				}
			});

			selected.forEach((child) => {
				if ((child as any).isMesh && child.name.includes('nucleus')) {
					(child as THREE.Mesh).visible = true;
				}
			});

			renderer.render(scene, camera);
		}
	}, [content, renderer, scene, camera, selected]);

	// Hide selected
	const onSelectedHide = useCallback(() => {
		if (content) {
			selected.forEach((child) => {
				if ((child as any).isMesh && child.name.includes('nucleus')) {
					(child as THREE.Mesh).visible = false;
				}
			});

			renderer.render(scene, camera);
		}
	}, [content, renderer, scene, camera, selected]);

	// Reset all to visible
	const onReset = useCallback(() => {
		if (content) {
			content.children.forEach((child) => {
				if ((child as any).isMesh && child.name.includes('nucleus')) {
					const nucleus = child as THREE.Mesh;
					(nucleus.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
					nucleus.visible = true;
				}
			});
			renderer.render(scene, camera);
		}

		// Reset slider values to min/max
		setResetToMinMax([min, max]);
	}, [content, renderer, scene, camera, min, max]);

	const fmt = (n: number) => n.toFixed(2);

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
						Colors and Filter
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						{/* Stats Display */}
						{featureMap && (
							<div className="mb-4 text-xs text-gray-500 bg-gray-50 p-2 rounded">
								<div className="flex justify-between">
									<span>Min: {fmt(min)}</span>
									<span>Max: {fmt(max)}</span>
								</div>
							</div>
						)}

						{/* Property dropdown */}
						<Listbox value={featureMap} onChange={setFeatureMap}>
							{({ open }) => (
								<>
									<Listbox.Label className="block text-sm font-medium text-gray-700 mb-1">
										Property
									</Listbox.Label>
									<div className="relative">
										<Listbox.Button className="bg-white relative w-full border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
											<span className="block truncate">
												{featureMap?.name || 'None'}
											</span>
											<span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
												<SelectorIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
											</span>
										</Listbox.Button>

										<Transition
											show={open}
											as={Fragment}
											leave="transition ease-in duration-100"
											leaveFrom="opacity-100"
											leaveTo="opacity-0"
										>
											<Listbox.Options className="absolute z-20 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
												{/* Stored properties */}
												{storedFeatures.length > 0 && (
													<>
														<div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
															Stored
														</div>
														{storedFeatures.map((setting, index) => (
															<Listbox.Option
																key={`stored-${index}`}
																className={({ active }) =>
																	classNames(
																		active ? 'text-white bg-teal-600' : 'text-gray-900',
																		'cursor-default select-none relative py-2 pl-3 pr-9'
																	)
																}
																value={setting}
															>
																{({ selected, active }) => (
																	<>
																		<span className={classNames(selected ? 'font-semibold' : 'font-normal', 'block truncate')}>
																			{setting.name}
																		</span>
																		{selected && (
																			<span className={classNames(active ? 'text-white' : 'text-teal-600', 'absolute inset-y-0 right-0 flex items-center pr-4')}>
																				<CheckIcon className="h-5 w-5" aria-hidden="true" />
																			</span>
																		)}
																	</>
																)}
															</Listbox.Option>
														))}
													</>
												)}

												{/* Transient properties */}
												{transientFeatures.length > 0 && (
													<>
														<div className={classNames(storedFeatures.length > 0 ? 'border-t border-gray-200' : '', 'px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50')}>
															Transient
														</div>
														{transientFeatures.map((setting, index) => (
															<Listbox.Option
																key={`transient-${index}`}
																className={({ active }) =>
																	classNames(
																		active ? 'text-white bg-teal-600' : 'text-gray-900',
																		'cursor-default select-none relative py-2 pl-3 pr-9'
																	)
																}
																value={setting}
															>
																{({ selected, active }) => (
																	<>
																		<span className={classNames(selected ? 'font-semibold' : 'font-normal', 'block truncate')}>
																			{setting.name}
																		</span>
																		{selected && (
																			<span className={classNames(active ? 'text-white' : 'text-teal-600', 'absolute inset-y-0 right-0 flex items-center pr-4')}>
																				<CheckIcon className="h-5 w-5" aria-hidden="true" />
																			</span>
																		)}
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

						{/* Color Scale */}
						<Listbox value={colorScale} onChange={setColorScale}>
							{({ open }) => (
								<>
									<Listbox.Label className="block text-sm font-medium text-gray-700 mt-4">
										Color Scale
									</Listbox.Label>
									<div className="mt-1 relative">
										<Listbox.Button className="bg-white relative w-full border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
											<span className="block truncate">{colorScale.name}</span>
											<span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
												<SelectorIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
											</span>
										</Listbox.Button>

										<Transition
											show={open}
											as={Fragment}
											leave="transition ease-in duration-100"
											leaveFrom="opacity-100"
											leaveTo="opacity-0"
										>
											<Listbox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
												{colorScales.map((scale, index) => (
													<Listbox.Option
														key={index}
														className={({ active }) =>
															classNames(
																active ? 'text-white bg-teal-600' : 'text-gray-900',
																'cursor-default select-none relative py-2 pl-3 pr-9'
															)
														}
														value={scale}
													>
														{({ selected, active }) => (
															<>
																<span className={classNames(selected ? 'font-semibold' : 'font-normal', 'block truncate')}>
																	{scale.name}
																</span>
																{selected && (
																	<span className={classNames(active ? 'text-white' : 'text-teal-600', 'absolute inset-y-0 right-0 flex items-center pr-4')}>
																		<CheckIcon className="h-5 w-5" aria-hidden="true" />
																	</span>
																)}
															</>
														)}
													</Listbox.Option>
												))}
											</Listbox.Options>
										</Transition>
									</div>
								</>
							)}
						</Listbox>

						{/* Normalise toggle */}
						<Switch.Group as="div" className="flex items-center mt-4">
							<Switch.Label as="span" className="flex-grow flex flex-col pr-2" passive>
								<span className="text-sm font-medium text-gray-900">Normalise</span>
								<span className="text-xs text-gray-500">Bound range to min-max values</span>
							</Switch.Label>
							<Switch
								checked={normalise}
								onChange={setNormalise}
								className="flex-shrink-0 group relative rounded-full inline-flex items-center justify-center h-5 w-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
							>
								<span className="sr-only">Normalise color map</span>
								<span aria-hidden="true" className="pointer-events-none absolute bg-white w-full h-full rounded-md" />
								<span
									aria-hidden="true"
									className={classNames(
										normalise ? 'bg-teal-600' : 'bg-gray-200',
										'pointer-events-none absolute h-4 w-9 mx-auto rounded-full transition-colors ease-in-out duration-200'
									)}
								/>
								<span
									aria-hidden="true"
									className={classNames(
										normalise ? 'translate-x-5' : 'translate-x-0',
										'pointer-events-none absolute left-0 inline-block h-5 w-5 border border-gray-200 rounded-full bg-white shadow transform ring-0 transition-transform ease-in-out duration-200'
									)}
								/>
							</Switch>
						</Switch.Group>

						{/* Filter range slider */}
						{featureMap && (
							<div className="mt-4">
								<div className="block text-sm font-medium text-gray-700 mb-2">Filter Range</div>
								<div className="flex items-center">
									<div className="text-sm">{values[0].toPrecision(2)}</div>
									<RangeSlider
										minValue={min}
										maxValue={max}
										defaultValue={[min, max]}
										resetToMinMax={resetToMinMax}
										step={(max - min) / 100 || 0.01}
										aria-label="adjust filter range"
										onValuesUpdate={onValuesUpdate}
									/>
									<div className="text-sm">{values[1].toPrecision(2)}</div>
								</div>
							</div>
						)}

						{/* Filter incomplete nuclei */}
						<div className="mt-4">
							<label className="flex items-center space-x-2 cursor-pointer">
								<input
									type="checkbox"
									checked={filterIncompleteNuclei}
									onChange={(e) => setFilterIncompleteNuclei(e.target.checked)}
									className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
								/>
								<span className="text-sm font-medium text-gray-700">Filter incomplete nuclei</span>
							</label>
						</div>

						{/* By selection */}
						<div className="block text-sm font-medium text-gray-700 mt-4">By selection</div>
						<span className="relative z-0 inline-flex shadow-sm rounded-md mt-1">
							<button
								type="button"
								className="relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
								onClick={onSelectedShow}
							>
								Show
							</button>
							<button
								type="button"
								className="-ml-px relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
								onClick={onSelectedHide}
							>
								Hide
							</button>
						</span>

						<button
							type="button"
							className="mt-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
							onClick={onReset}
						>
							Reset
						</button>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
};

export default ColorsAndFilter;
