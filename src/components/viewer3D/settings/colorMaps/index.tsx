import { Fragment, useState, useEffect } from 'react'
import { Disclosure, Listbox, Transition, Switch } from '@headlessui/react'
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid'
import { Camera, Scene, WebGLRenderer, Group, Color } from 'three'
import * as d3 from 'd3'

import ColorMap from './ColorMap'
import FooterToolbar from './FooterToolbar'

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ')
}

function normalize(min: number, max: number) {
	const delta = max - min
	return (val: number) => (val - min) / delta
}

const allFeatures = [
	{ name: 'Segmentation confidence', value: 'segmentationConfidence' },
	{ name: 'Diameter', value: 'nucleusDiameters' },
	{ name: 'Volume', value: 'nucleusVolumes' },
	{ name: 'Elongation', value: 'elongations' },
	{ name: 'Epithelial Scores', value: 'epithelialScores' },
	{ name: 'Mesenchymal Score', value: 'mesenchymalScores' },
	{ name: 'Irregularity Score', value: 'nucleusIrregularityScores' },
	{ name: 'gH2AX', value: 'is_gH2AX' },
	{ name: 'CD8', value: 'is_CD8' },
]

// https://github.com/d3/d3-scale-chromatic
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
			if (value > 0.5) return 'rgb(255,247,0)'
			else return 'rgb(255,255,247)'
		},
	},
	{
		name: 'Binary red',
		value: (value: number) => {
			if (value > 0.5) return 'rgb(255,0,0)'
			else return 'rgb(255,247,247)'
		},
	},
]

const ColorMaps = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
	featureData: any;
}) => {
	const { content, scene, camera, renderer, featureData } = props

	const [features, setFeatures] = useState(allFeatures)
	const [colorMaps, setColorMaps] = useState([
		{
			featureMap: allFeatures[7],
			colorScale: colorScales[10],
			normalise: true,
		},
		{
			featureMap: allFeatures[8],
			colorScale: colorScales[11],
			normalise: true,
		},
	]);
	const [activeColorMapIndex, setActiveColorMapIndex] = useState(0)

	const deleteColorMap = (index: number) => {
		const newColorMaps = [...colorMaps]
		newColorMaps.splice(index, 1)
		setColorMaps(newColorMaps)
		if (activeColorMapIndex === index) {
			setActiveColorMapIndex(0)
		}
	}

	// When new tile is chosen featureData will update. We need to check which
	// features are available in the new tile.
	useEffect(() => {
		if (featureData) {
			const featureSubset = allFeatures.filter((f) =>
				Object.keys(featureData).includes(f.value)
			)
			setFeatures(featureSubset)
		}
	}, [featureData])

	// Update 3D mesh colors
	useEffect(() => {
		if (featureData && content) {
			content.children.forEach((child, index) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					let color;
					if (colorMaps.length === 0) {
						// If no color maps are active, revert to the default color
						const label = parseInt(child.name.split('_')[1]);
						color = new Color().setHSL(label / 10, 0.8, 0.6).getStyle();
					} else {
						// Combine colors from all maps
						color = colorMaps[0].colorScale.value(
							(() => {
								const featureValues = featureData[colorMaps[0].featureMap.value];
								const mapMax = Math.max(...featureValues);
								const mapMin = Math.min(...featureValues);

								const featureValue = colorMaps[0].normalise
									? normalize(mapMin, mapMax)(featureValues[index])
									: featureValues[index];

								return featureValue;
							})()
						);

						for (let i = 1; i < colorMaps.length; i++) {
							const colorMap = colorMaps[i];
							const featureValues = featureData[colorMap.featureMap.value];
							const mapMax = Math.max(...featureValues);
							const mapMin = Math.min(...featureValues);

							const featureValue = colorMap.normalise
								? normalize(mapMin, mapMax)(featureValues[index])
								: featureValues[index];

							color = d3.interpolate(
								color,
								colorMap.colorScale.value(featureValue)
							)(featureValue);
						}
					}

					const nucleus = child as THREE.Mesh;
					const newMaterial = (nucleus.material as THREE.MeshStandardMaterial).clone();
					newMaterial.color.setStyle(color);
					nucleus.material = newMaterial;
				}
			});
			renderer.render(scene, camera);
		}
	}, [
		content,
		renderer,
		scene,
		camera,
		featureData,
		activeColorMapIndex,
		colorMaps,
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
											const newColorMaps = [...prev]
											newColorMaps[activeColorMapIndex].featureMap = value
											return newColorMaps
										})
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
													<Listbox.Options
														className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
													>
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

								{/* Change D3 color scale */}
								<Listbox
									value={colorMaps[activeColorMapIndex].colorScale}
									onChange={(value) => {
										setColorMaps((prev) => {
											const newColorMaps = [...prev]
											newColorMaps[activeColorMapIndex].colorScale = value
											return newColorMaps
										})
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
													<Listbox.Options
														className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
													>
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
																				selected ? 'font-semibold' : 'font-normal',
																				'block truncate'
																			)}
																		>
																			{scale.name}
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
												const newColorMaps = [...prev]
												newColorMaps[activeColorMapIndex].normalise = value
												return newColorMaps
											})
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
								setColorMaps((prev) => [
									...prev,
									{
										featureMap: allFeatures[0],
										colorScale: colorScales[4],
										normalise: true,
									},
								])
								setActiveColorMapIndex(colorMaps.length)
							}}
						/>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default ColorMaps