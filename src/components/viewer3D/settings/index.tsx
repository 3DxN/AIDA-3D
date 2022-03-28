import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid'

import { WebGLRenderer, Scene, Camera, Group } from 'three'

import Clipping from './Clipping'
import Explode from './Explode'
import ColorMap from './ColorMap'
import Filter from './Filter'
import Orientation from './Orientation'
import Labels from './Labels'
import Export from './Export'

import { resizeRendererToDisplaySize } from '../utils'

export default function Settings(props: {
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
	content: Group
}) {
	const { renderer, scene, camera, content, featureData, selected } = props

	const [isOpen, setIsOpen] = useState(true)

	return (
		<>
			{/* Open button */}
			{!isOpen && <button
				onClick={() => {
					setIsOpen(true)
					resizeRendererToDisplaySize(renderer)
				}}
				className="rounded-bl-md hover:bg-gray-100 border-gray-200 shadow p-2 bg-white absolute top-0 right-0 inline-flex items-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
			>
				<ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
				Settings
			</button>}

			{/* Content */}
			{isOpen && (
				<div className="bg-white border-l border-gray-200 h-screen shadow text-gray-800 flex flex-col divide-y">
					{/* Close button */}
					<button
						onClick={() => {
							setIsOpen(false)
							resizeRendererToDisplaySize(renderer)
						}}
						className="w-48 flex justify-between hover:bg-gray-100 p-2 items-center focus:outline-none  ring-inset focus:ring-2 focus:ring-teal-500"
					>
						Settings
						<ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
					</button>
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
						renderer={renderer}
						scene={scene}
						camera={camera}
						content={content}
						featureData={featureData}
						selected={selected}
					/>
					<Export
						renderer={renderer}
						scene={scene}
						camera={camera}
						content={content}
						featureData={featureData}
					/>
				</div>
			)}
		</>
	)
}
