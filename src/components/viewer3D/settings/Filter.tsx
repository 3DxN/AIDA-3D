import { Fragment, useState, useEffect, useCallback } from 'react'
import { Disclosure, Listbox, Transition } from '@headlessui/react'
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid'
import { Camera, Scene, WebGLRenderer, Group } from 'three'

import RangeSlider from '../../interaction/RangeSlider'

import classNames from '../../../lib/utils/classNames'


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

const Filter = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
}) => {
	const { content, scene, camera, renderer, featureData, selected } = props

	const [featureMap, setFeatureMap] = useState(allFeatures[0])
	const [features, setFeatures] = useState([allFeatures])
	const [min, setMin] = useState(0)
	const [max, setMax] = useState(1)
	const [values, setValues] = useState([0, 0])
	const [normalizedMap, setNormalizedMap] = useState(null)
	const [resetToMinMax, setResetToMinMax] = useState(null)

	// When new tile is chosen featureData will update. We need to check which
	// features are available in the new tile.
	useEffect(() => {
		if (featureData) {
			const featureSubset = allFeatures.filter((f) =>
				Object.keys(featureData).includes(f.value)
			)
			setFeatures(featureSubset)
			setFeatureMap(featureSubset[0])
		}
	}, [featureData])

	const onValuesUpdate = useCallback(
		(rangeValues) => {
			if (content && featureData) {
				content.children.forEach((child, index) => {
					if (child.isMesh && child.name.includes('nucleus')) {
						const nucleus = child
						const value = normalizedMap[index]
						if (value < rangeValues[0] || value > rangeValues[1])
							nucleus.visible = false
						else nucleus.visible = true
					}
				})

				renderer.render(scene, camera)
			}
		},
		[renderer, content, normalizedMap, camera, scene, featureData]
	)

	// Show only selected meshes
	const onSelectedShow = useCallback(() => {
		if (content) {
			content.children.forEach((child, index) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child
					nucleus.visible = false
				}
			})

			selected.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child
					nucleus.visible = true
				}
			})

			renderer.render(scene, camera)
		}
	}, [content, renderer, scene, camera, selected])

	// Hide selected meshes
	const onSelectedHide = useCallback(() => {
		if (content) {
			selected.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child
					nucleus.visible = false
				}
			})

			renderer.render(scene, camera)
		}
	}, [content, renderer, scene, camera, selected])

	// Reset all meshes to visible
	const onReset = useCallback(() => {
		if (content) {
			content.children.forEach((child, index) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child
					nucleus.material.emissive.set(0x000000)
					nucleus.visible = true
				}
			})
			renderer.render(scene, camera)
		}

		// Reset slider values to min max
		// This is kinda a hack; we deep clone the featureMap object and update the
		// state in order to trigger the reset useEffect callback defined below.
		setFeatureMap((featureMap) => JSON.parse(JSON.stringify(featureMap)))
	}, [content, renderer, scene, camera])

	// Color maps
	useEffect(() => {
		if (featureData && content && featureMap) {
			const chosenMap = featureData[featureMap.value]

			const mapMax = Math.max(...chosenMap)
			const mapMin = Math.min(...chosenMap)

			setNormalizedMap(chosenMap)
			setMax(mapMax)
			setMin(mapMin)
			setResetToMinMax([mapMin, mapMax])

			setValues([mapMin, mapMax])
		}
	}, [content, renderer, scene, camera, featureMap, featureData])

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
						<Listbox value={featureMap} onChange={setFeatureMap}>
							{({ open }) => (
								<>
									<Listbox.Label className="block text-sm font-medium text-gray-700">
										By feature
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
												static
												className="mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
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

						{/* Range slider */}
						<div className="mt-4 flex items-center ">
							<div className="text-sm">{values[0].toPrecision(2)}</div>
							<RangeSlider
								minValue={min}
								maxValue={max}
								defaultValue={[min, max]}
								step={(max - min) / 100}
								aria-label="adjust filter range"
								onValuesUpdate={onValuesUpdate}
								resetToMinMax={resetToMinMax}
							/>
							<div className="text-sm">{values[1].toPrecision(2)}</div>
						</div>

						{/* By selection */}
						<div className="block text-sm font-medium text-gray-700 mt-4">
							By selection
						</div>

						<span className="relative z-0 inline-flex shadow-sm rounded-md mt-1">
							<button
								type="button"
								className="relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
								onClick={() => {
									onSelectedShow()
								}}
							>
								Show
							</button>
							<button
								type="button"
								className="-ml-px relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
								onClick={() => {
									onSelectedHide()
								}}
							>
								Hide
							</button>
						</span>

						<button
							type="button"
							className="mt-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
							onClick={() => {
								onReset()
							}}
						>
							Reset
						</button>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Filter
