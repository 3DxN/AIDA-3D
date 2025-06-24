import { useEffect, useState, useRef, useCallback } from 'react'
import { Disclosure } from '@headlessui/react'
import { XIcon } from '@heroicons/react/outline'
import { Camera, Scene, WebGLRenderer, Group } from 'three'

import NumberField from '../../interaction/NumberField'

import classNames from '../../../lib/utils/classNames'


const Explode = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
}) => {
	const { content, scene, camera, renderer } = props

	const [value, setValue] = useState(0)
	const cache = useRef(0)

	const explode = useCallback(
		(magnitude) => {
			content.traverse((child) => {
				if (child.isMesh) {
					const { center } = child.geometry.boundingSphere
					const direction = center.clone()
					const length = direction.length()
					direction.normalize()

					child.translateOnAxis(direction, (length * magnitude) / 10)
				}
			})
			renderer.render(scene, camera)
		},
		[camera, content, renderer, scene]
	)

	useEffect(() => {
		const diff = value - cache.current
		if (diff !== 0) explode(diff)
		cache.current = value
	}, [value, explode])

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
						Explode
					</Disclosure.Button>
					<Disclosure.Panel className="relative w-48">
						<div className="px-4 flex py-2 justify-between items-center">
							<NumberField
								value={value}
								onChange={setValue}
								minValue={0}
								aria-label={
									'Explode: separate segmented objects from each other.'
								}
							/>
							<button
								type="button"
								className={`${
									value === 0
										? 'text-gray-200'
										: 'text-gray-600 hover:bg-gray-200'
								} ml-2 inline-flex items-center p-1 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500`}
								disabled={value === 0}
								onClick={() => setValue(0)}
							>
								<XIcon className="h-3 w-3" aria-hidden="true" />
							</button>
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Explode
