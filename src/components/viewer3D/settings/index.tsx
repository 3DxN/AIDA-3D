// src/components/viewer3D/settings/index.tsx

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid'
import { WebGLRenderer, Scene, Camera, Group } from 'three'

import Clipping from './Clipping'
import Explode from './Explode'
import ColorMap from './colorMaps'
import Filter from './Filter'
import Orientation from './Orientation'
import Labels from './Labels'
import Export from './Export'
import SelectedIndices from './SelectedIndices'

import { resizeRendererToDisplaySize } from '../utils'

export default function Settings(props: {
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
	content: Group
	featureData: any
	selected: any[]
	setFeatureData: (data: any) => void
	globalLabels: any
	globalLabelTypes: any
}) {
	const {
		renderer,
		scene,
		camera,
		content,
		featureData,
		selected,
		setFeatureData,
		globalLabels,
		globalLabelTypes,
	} = props

	const [isOpen, setIsOpen] = useState(true)

	return (
		<>
			{!isOpen && (
				<button
					onClick={() => {
						setIsOpen(true)
						if (renderer) resizeRendererToDisplaySize(renderer)
					}}
					className="rounded-bl-md hover:bg-gray-100 border-gray-200 shadow p-2 bg-white absolute top-0 right-0 inline-flex items-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
				>
					<ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
					Settings
				</button>
			)}

			{isOpen && (
				<div className="bg-white border-l border-gray-200 h-screen shadow text-gray-800 flex flex-col divide-y overflow-y-auto">
					<button
						onClick={() => {
							setIsOpen(false)
							if (renderer) resizeRendererToDisplaySize(renderer)
						}}
						className="w-48 flex justify-between hover:bg-gray-100 p-2 items-center focus:outline-none  ring-inset focus:ring-2 focus:ring-teal-500"
					>
						Settings
						<ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
					</button>
					<SelectedIndices selected={selected} />
					<Clipping renderer={renderer} scene={scene} camera={camera} />
					<Explode
						renderer={renderer}
						scene={scene}
						camera={camera}
						content={content}
					/>
					<ColorMap
						renderer={renderer}
						scene={scene}
						camera={camera}
						content={content}
						featureData={featureData}
					/>
					<Filter
						renderer={renderer}
						scene={scene}
						camera={camera}
						content={content}
						featureData={featureData}
						selected={selected}
					/>
					<Orientation
						renderer={renderer}
						scene={scene}
						camera={camera}
						content={content}
						featureData={featureData}
					/>
					<Labels
						featureData={featureData}
						selected={selected}
						setFeatureData={setFeatureData}
						globalLabels={globalLabels}
						globalLabelTypes={globalLabelTypes}
					/>
					<Export
						renderer={renderer}
						content={content}
						globalLabels={globalLabels}
						globalLabelTypes={globalLabelTypes}
						setFeatureData={setFeatureData}
					/>
				</div>
			)}
		</>
	)
}