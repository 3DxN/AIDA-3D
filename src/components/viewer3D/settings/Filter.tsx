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
	globalAttributes: React.MutableRefObject<{ nucleus_index: number;[key: string]: any }[]>;
	globalAttributeTypes: React.MutableRefObject<{ id: number; name: string; count: number; readOnly: boolean, dimensions?: number[] }[]>;
}) => {
	const { content, scene, camera, renderer, featureData, selected, globalAttributes, globalAttributeTypes } = props;

	const [featureMap, setFeatureMap] = useState<{ name: string, value: string } | null>(null);
	const [features, setFeatures] = useState<{ name: string, value: string }[]>([]);
	const [min, setMin] = useState(0);
	const [max, setMax] = useState(1);
	const [values, setValues] = useState([0, 0]);
	const [normalizedMap, setNormalizedMap] = useState(null);
	const [resetToMinMax, setResetToMinMax] = useState<[number, number] | null>(null);

	// When new attribute types are available, update the list of features.
	useEffect(() => {
		if (globalAttributeTypes && globalAttributeTypes.current) {
			const attributeFeatures = globalAttributeTypes.current
				.filter(attr => !attr.dimensions) // Filter out multi-dimensional attributes for the slider
				.map(attr => ({ name: attr.name, value: attr.name }));
			setFeatures(attributeFeatures);

			// If there's no feature selected, or the selected one is no longer valid, select the first one.
			if (!featureMap || !attributeFeatures.some(f => f.value === featureMap.value)) {
				setFeatureMap(attributeFeatures.length > 0 ? attributeFeatures[0] : null);
			}
		}
		// Rerun this effect when featureData changes, as this indicates attributes may have changed.
	}, [featureData, globalAttributeTypes, featureMap]);

	const onValuesUpdate = useCallback(
		(rangeValues) => {
			if (content && featureData && featureMap && globalAttributes.current) {
				const attributeName = featureMap.value;
				const attributeValues = globalAttributes.current.reduce((acc, curr) => {
					acc[curr.nucleus_index] = curr[attributeName];
					return acc;
				}, {} as { [key: number]: number });

				content.children.forEach((child) => {
					if (child.isMesh && child.name.includes('nucleus')) {
						const nucleus = child as Mesh;
						const nucleusIndex = parseInt(child.name.split('_')[1], 10);
						const value = attributeValues[nucleusIndex];
						if (value < rangeValues[0] || value > rangeValues[1])
							nucleus.visible = false;
						else
							nucleus.visible = true;
					}
				});

				renderer.render(scene, camera);
			}
		},
		[renderer, content, featureMap, camera, scene, featureData, globalAttributes]
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

		// Reset slider values to min max
		if (featureMap) {
			setFeatureMap(JSON.parse(JSON.stringify(featureMap)));
		}
	}, [content, renderer, scene, camera, featureMap]);

	// Set slider min/max based on the selected attribute
	useEffect(() => {
		if (featureData && content && featureMap && globalAttributes.current) {
			const attributeName = featureMap.value;
			const values = globalAttributes.current.map(attr => attr[attributeName]).filter(val => typeof val === 'number');

			if (values && values.length > 0) {
				const mapMax = Math.max(...values);
				const mapMin = Math.min(...values);

				setNormalizedMap(values);
				setMax(mapMax);
				setMin(mapMin);
				setResetToMinMax([mapMin, mapMax]);
				setValues([mapMin, mapMax]);
			}
		}
	}, [content, renderer, scene, camera, featureMap, featureData, globalAttributes]);

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
						{/* Change feature map */}
						{featureMap && (
							<Listbox value={featureMap} onChange={setFeatureMap}>
								{({ open }) => (
									<>
										<Listbox.Label className="block text-sm font-medium text-gray-700">
											By attribute
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
													{features.map((setting) => (
														<Listbox.Option
															key={setting.value}
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
									minValue={min}
									maxValue={max}
									defaultValue={[min, max]}
									step={(max - min) / 100 || 0.01}
									aria-label="adjust filter range"
									onValuesUpdate={onValuesUpdate}
									resetToMinMax={resetToMinMax}
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