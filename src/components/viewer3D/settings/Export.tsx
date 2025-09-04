/* eslint-disable max-len */
import { useState, useCallback } from 'react'
import { Disclosure } from '@headlessui/react'
import { WebGLRenderer, Group } from 'three'
import { SaveIcon } from '@heroicons/react/solid'

function classNames(...classes) {
	return classes.filter(Boolean).join(' ')
}

const Export = (props: { content: Group; renderer: WebGLRenderer }) => {
	const { content, renderer, featureData } = props

	const [onlyVisible, setOnlyVisible] = useState(true)
	const [onlySelected, setOnlySelected] = useState(false)
	const [fileType, setFileType] = useState('json')

	const exportData = useCallback(() => {
		let nuclei = content.children.filter(
			(child) => child.isMesh && child.name.includes('nucleus')
		)

		if (onlyVisible) {
			nuclei = nuclei.filter((nucleus) => nucleus.visible)

			// Filter for clipping planes
			nuclei = nuclei.filter((nucleus) => {
				return renderer.clippingPlanes.every((clippingPlane) => {
					nucleus.geometry.computeBoundingSphere()
					const centerPoint = nucleus.geometry.boundingSphere.center.clone()
					const center = nucleus.localToWorld(centerPoint)
					const distanceToPoint = clippingPlane.distanceToPoint(center)

					return distanceToPoint > 0
				})
			})
		}

		// Selected is indicated via the white emissive color.
		if (onlySelected)
			nuclei = nuclei.filter(
				(nucleus) => nucleus.material.emissive.getHexString() === 'ffffff'
			)

		// Extra nuclei indices from mesh names
		const nucleiIndices = nuclei.map((nucleus) =>
			Number(nucleus.name.split('_')[1])
		)

		// Filter feature data but the subset of nuclei indices we are interested in
		const filteredFeatureData = { ...featureData }
		for (const feature of Object.keys(filteredFeatureData)) {
			filteredFeatureData[feature] = nucleiIndices.map(
				(index) => filteredFeatureData[feature][index]
			)
		}

		// Add nuclei indices to feature data
		filteredFeatureData.nucleusIndex = nucleiIndices
		// Convert label Sets to Arrays for serialization
		if (filteredFeatureData.labels) {
			filteredFeatureData.labels = filteredFeatureData.labels.map((labelSet) =>
				labelSet ? Array.from(labelSet) : []
			)
		}
		// Prepare output as either JSON or CSV
		let output = ''
		if (fileType === 'json') {
			output = JSON.stringify(filteredFeatureData)
		} else if (fileType === 'csv') {
			// Header row
			output = output
				.concat(Object.keys(filteredFeatureData).join(','))
				.concat('\n')

			// Data rows
			for (const index in nucleiIndices) {
				for (const feature of Object.keys(filteredFeatureData)) {
					let value = filteredFeatureData[feature][index].toString()

					// If the value includes a comma, surround it with double quotes.
					// HACK to allow the inclusion of [arrays] in CSV in the same column.
					if (value.includes(',')) value = `"${value}"`
					output = output.concat(value).concat(',')
				}
				output = output.concat('\n')
			}
		}

		// Download output as file
		const element = document.createElement('a')
		element.setAttribute(
			'href',
			'data:text/plain;charset=utf-8,' + encodeURIComponent(output)
		)
		element.setAttribute('download', `aida-3D-export.${fileType}`)

		element.style.display = 'none'
		document.body.appendChild(element)

		element.click()

		document.body.removeChild(element)
	}, [content, onlySelected, onlyVisible, featureData, renderer, fileType])

	return (
		<Disclosure className="shadow-sm" as="div">
			{({ open }) => (
				<>
					<Disclosure.Button
						className={classNames(
							'text-gray-700 hover:bg-gray-50 border-b border-gray-200 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
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
						Export
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						{/* Filter meshes to export */}
						<div className="ml-2 flex justify-between items-center">
							only visible
							<button
								type="button"
								className="ml-4 flex-shrink-0 group relative rounded-full inline-flex items-center justify-center h-5 w-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
								aria-pressed="false"
								onClick={() => setOnlyVisible((a) => !a)}
							>
								<span className="sr-only">Toggle axes visibility</span>
								<span
									aria-hidden="true"
									className="pointer-events-none absolute bg-white w-full h-full rounded-md"
								/>
								<span
									aria-hidden="true"
									className={`${
										onlyVisible ? 'bg-teal-600' : 'bg-gray-200'
									} pointer-events-none absolute h-4 w-9 mx-auto rounded-full transition-colors ease-in-out duration-200`}
								/>
								<span
									aria-hidden="true"
									className={`${
										onlyVisible ? 'translate-x-5' : 'translate-x-0'
									} pointer-events-none absolute left-0 inline-block h-5 w-5 border border-gray-200 rounded-full bg-white shadow transform ring-0 transition-transform ease-in-out duration-200`}
								/>
							</button>
						</div>
						<div className="ml-2 flex justify-between items-center">
							only selected
							<button
								type="button"
								className="ml-4 flex-shrink-0 group relative rounded-full inline-flex items-center justify-center h-5 w-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
								aria-pressed="false"
								onClick={() => setOnlySelected((a) => !a)}
							>
								<span className="sr-only">Toggle axes visibility</span>
								<span
									aria-hidden="true"
									className="pointer-events-none absolute bg-white w-full h-full rounded-md"
								/>
								<span
									aria-hidden="true"
									className={`${
										onlySelected ? 'bg-teal-600' : 'bg-gray-200'
									} pointer-events-none absolute h-4 w-9 mx-auto rounded-full transition-colors ease-in-out duration-200`}
								/>
								<span
									aria-hidden="true"
									className={`${
										onlySelected ? 'translate-x-5' : 'translate-x-0'
									} pointer-events-none absolute left-0 inline-block h-5 w-5 border border-gray-200 rounded-full bg-white shadow transform ring-0 transition-transform ease-in-out duration-200`}
								/>
							</button>
						</div>

						{/* Select filetype */}
						<div>
							<label className="mt-4 ml-2 flex justify-between items-center">
								<span>JSON</span>
								<input
									onChange={(e) => setFileType(e.currentTarget.value)}
									className="mr-4"
									type="radio"
									name="fileType"
									value="json"
									checked={fileType === 'json'}
								/>
							</label>
							<label className="mt-1 ml-2 flex justify-between items-center">
								<span>CSV</span>
								<input
									onChange={(e) => setFileType(e.currentTarget.value)}
									className="mr-4"
									type="radio"
									name="fileType"
									value="csv"
									checked={fileType === 'csv'}
								/>
							</label>
						</div>

						{/* Export */}
						<div className="ml-2 mt-12 flex">
							<button
								onClick={() => exportData()}
								type="button"
								className="mt-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
							>
								Export
								<SaveIcon className="ml-2 -mr-0.5 h-4 w-4" aria-hidden="true" />
							</button>
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Export
