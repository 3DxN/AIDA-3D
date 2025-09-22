import { Fragment, useState, useEffect } from 'react';
import { Disclosure, Listbox, Transition, Switch } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';
import * as THREE from 'three';
import * as d3 from 'd3';

import ColorMap from './ColorMap';
import FooterToolbar from './FooterToolbar';
import { useNucleusColor } from '../../../../lib/contexts/NucleusColorContext';

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ');
}

function normalize(min: number, max: number) {
	const delta = max - min;
	if (delta === 0) {
		return () => 0.5; // Return midpoint if all values are the same
	}
	return (val: number) => (val - min) / delta;
}

const colorScales = [
	{
		name: 'Brown to teal-green',
		value: d3.interpolateBrBG,
	},
	{
		name: 'Purple to green',
		value: d3.interpolatePRGn,
	},
	{
		name: 'Red to blue',
		value: d3.interpolateRdBu,
	},
	{
		name: 'Spectral',
		value: d3.interpolateSpectral,
	},
	{
		name: 'Blues',
		value: d3.interpolateBlues,
	},
	{
		name: 'Greens',
		value: d3.interpolateGreens,
	},
	{
		name: 'Reds',
		value: d3.interpolateReds,
	},
	{
		name: 'Greys',
		value: d3.interpolateGreys,
	},
	{
		name: 'Purples',
		value: d3.interpolatePurples,
	},
	{
		name: 'Oranges',
		value: d3.interpolateOranges,
	},
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

const ColorMaps = (props: {
	content: THREE.Group;
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camera: THREE.Camera;
	featureData: any;
	globalPropertyTypes: React.MutableRefObject<
		{ id: number; name: string; count: number; readOnly: boolean; dimensions?: number[] }[]
	>;
	globalProperties: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: any }[]
	>;
}) => {
	const {
		content,
		scene,
		camera,
		renderer,
		featureData,
		globalPropertyTypes,
		globalProperties,
	} = props;

	const { updateNucleusColors } = useNucleusColor();

	const [features, setFeatures] = useState<{ name: string; value: string }[]>([]);
	const [colorMaps, setColorMaps] = useState<
		{ featureMap: { name: string; value: string }; colorScale: any; normalise: boolean }[]
	>([]);
	const [activeColorMapIndex, setActiveColorMapIndex] = useState(0);

	const deleteColorMap = (index: number) => {
		const newColorMaps = [...colorMaps];
		newColorMaps.splice(index, 1);
		setColorMaps(newColorMaps);
		if (activeColorMapIndex >= newColorMaps.length) {
			setActiveColorMapIndex(Math.max(0, newColorMaps.length - 1));
		}
	};

	useEffect(() => {
		if (globalPropertyTypes && globalPropertyTypes.current) {
			const propertyFeatures = globalPropertyTypes.current
				.filter((attr) => !attr.dimensions) // Filter for single-dimensional properties
				.map((attr) => ({ name: attr.name, value: attr.name }));
			setFeatures(propertyFeatures);
		}
	}, [featureData, globalPropertyTypes]);

	// Separate effect to initialize default color map when features are available and properties are loaded
	useEffect(() => {
		if (
			features.length > 0 &&
			colorMaps.length === 0 &&
			globalProperties.current.length > 0 &&
			globalPropertyTypes.current.length > 0
		) {
			console.log('🎨 Initializing default Spectral color map after zarr properties loaded');
			const initialColorMap = {
				featureMap: features[0],
				colorScale: colorScales[3], // Spectral
				normalise: true,
			};
			setColorMaps([initialColorMap]);
		}
	}, [features, colorMaps.length, globalProperties, globalPropertyTypes]);

	// Update 3D mesh colors
	useEffect(() => {
		if (
			!content ||
			!renderer ||
			!scene ||
			!camera ||
			!globalProperties.current
		) {
			return;
		}

		const activeColorMap = colorMaps[activeColorMapIndex];
		const colorMap = new Map<number, THREE.Color>();

		if (!activeColorMap) {
			// If no color maps, revert to a default color
			content.children.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
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

		const featureName = activeColorMap.featureMap.value;
		const allValues = globalProperties.current
			.map((attr) => attr[featureName])
			.filter((v): v is number => typeof v === 'number');

		if (allValues.length === 0) {
			updateNucleusColors(colorMap);
			renderer.render(scene, camera);
			return;
		}

		const mapMin = allValues.reduce((a, b) => Math.min(a, b), Infinity);
		const mapMax = allValues.reduce((a, b) => Math.max(a, b), -Infinity);

		content.children.forEach((child) => {
			if (child.isMesh && child.name.includes('nucleus')) {
				const nucleus = child as THREE.Mesh;
				const material = nucleus.material as THREE.MeshStandardMaterial;
				const nucleusIndex = parseInt(child.name.split('_')[1], 10);
				const nucleusPropertyData = globalProperties.current.find(
					(l) => l.nucleus_index === nucleusIndex
				);

				if (!nucleusPropertyData) {
					material.color.set(0x808080); // Default grey
					colorMap.set(nucleusIndex, material.color.clone());
					return;
				}

				const value = nucleusPropertyData[featureName];

				if (typeof value !== 'number') {
					material.color.set(0x808080);
					colorMap.set(nucleusIndex, material.color.clone());
					return;
				}

				const normalizedValue = activeColorMap.normalise
					? normalize(mapMin, mapMax)(value)
					: value;
				const colorString = activeColorMap.colorScale.value(normalizedValue);

				material.color.set(new THREE.Color(colorString));
				colorMap.set(nucleusIndex, material.color.clone());
			}
		});

		updateNucleusColors(colorMap);
		renderer.render(scene, camera);
	}, [
		colorMaps,
		activeColorMapIndex,
		globalProperties,
		content,
		renderer,
		scene,
		camera,
		updateNucleusColors,
	]);

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
						Color Maps
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						{/* Only render controls if a color map exists */}
						{colorMaps.length > 0 && colorMaps[activeColorMapIndex] && (
							<>
								{/* Change feature map */}
								<Listbox
									value={colorMaps[activeColorMapIndex].featureMap}
									onChange={(value) => {
										setColorMaps((prev) => {
											const newColorMaps = [...prev];
											newColorMaps[activeColorMapIndex].featureMap = value;
											return newColorMaps;
										});
									}}
								>
									{({ open }) => (
										<>
											<Listbox.Label className="block text-sm font-medium text-gray-700">
												Feature
											</Listbox.Label>
											<div className="mt-1 relative">
												<Listbox.Button className="relative w-full border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
													<span className="block truncate">
														{colorMaps[activeColorMapIndex].featureMap.name}
													</span>
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
													<Listbox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
														{features.map((setting, index) => (
															<Listbox.Option
																key={index}
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
																				selected
																					? 'font-semibold'
																					: 'font-normal',
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
													</Listbox.Options>
												</Transition>
											</div>
										</>
									)}
								</Listbox>

								{/* Change D3 color scale */}
								<Listbox
									value={colorMaps[activeColorMapIndex].colorScale}
									onChange={(value) => {
										setColorMaps((prev) => {
											const newColorMaps = [...prev];
											newColorMaps[activeColorMapIndex].colorScale = value;
											return newColorMaps;
										});
									}}
								>
									{({ open }) => (
										<>
											<Listbox.Label className="block text-sm font-medium text-gray-700 mt-4">
												Color Scale
											</Listbox.Label>
											<div className="mt-1 relative">
												<Listbox.Button className="bg-white relative w-full border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
													<span className="block truncate">
														{colorMaps[activeColorMapIndex].colorScale.name}
													</span>
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
													<Listbox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
														{colorScales.map((scale, index) => (
															<Listbox.Option
																key={index}
																className={({ active }) =>
																	classNames(
																		active
																			? 'text-white bg-teal-600'
																			: 'text-gray-900',
																		'cursor-default select-none relative py-2 pl-3 pr-9'
																	)
																}
																value={scale}
															>
																{({ selected, active }) => (
																	<>
																		<span
																			className={classNames(
																				selected
																					? 'font-semibold'
																					: 'font-normal',
																				'block truncate'
																			)}
																		>
																			{scale.name}
																		</span>

																		{selected ? (
																			<span
																				className={classNames(
																					active
																						? 'text-white'
																						: 'text-teal-600',
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
													</Listbox.Options>
												</Transition>
											</div>
										</>
									)}
								</Listbox>

								{/* Normalise color map, between max-min values. */}
								<Switch.Group as="div" className="flex items-center mt-4">
									<Switch.Label
										as="span"
										className="flex-grow flex flex-col pr-2"
										passive
									>
										<span className="text-sm font-medium text-gray-900">
											Normalise
										</span>
										<span className="text-xs text-gray-500">
											Bound range to min-max feature values
										</span>
									</Switch.Label>
									<Switch
										checked={colorMaps[activeColorMapIndex].normalise}
										onChange={(value) => {
											setColorMaps((prev) => {
												const newColorMaps = [...prev];
												newColorMaps[activeColorMapIndex].normalise = value;
												return newColorMaps;
											});
										}}
										className="flex-shrink-0 group relative rounded-full inline-flex items-center justify-center h-5 w-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
									>
										<span className="sr-only">Normalise color map</span>
										<span
											aria-hidden="true"
											className="pointer-events-none absolute bg-white w-full h-full rounded-md"
										/>
										<span
											aria-hidden="true"
											className={classNames(
												colorMaps[activeColorMapIndex].normalise
													? 'bg-teal-600'
													: 'bg-gray-200',
												'pointer-events-none absolute h-4 w-9 mx-auto rounded-full transition-colors ease-in-out duration-200'
											)}
										/>
										<span
											aria-hidden="true"
											className={classNames(
												colorMaps[activeColorMapIndex].normalise
													? 'translate-x-5'
													: 'translate-x-0',
												'pointer-events-none absolute left-0 inline-block h-5 w-5 border border-gray-200 rounded-full bg-white shadow transform ring-0 transition-transform ease-in-out duration-200'
											)}
										/>
									</Switch>
								</Switch.Group>
							</>
						)}

						{/* List of active color maps */}
						<div className="max-h-40 overflow-y-auto mt-4">
							{colorMaps.map((colorMap, index) => (
								<ColorMap
									key={index}
									colorMap={colorMap}
									index={index}
									active={activeColorMapIndex === index}
									setActive={setActiveColorMapIndex}
									deleteColorMap={deleteColorMap}
								/>
							))}
						</div>

						{/* Footer toolbar */}
						<FooterToolbar
							addNew={() => {
								if (features.length > 0) {
									setColorMaps((prev) => [
										...prev,
										{
											featureMap: features[0],
											colorScale: colorScales[3],
											normalise: true,
										},
									]);
									setActiveColorMapIndex(colorMaps.length);
								}
							}}
						/>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
};

export default ColorMaps;