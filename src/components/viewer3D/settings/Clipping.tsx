import { useState, useEffect, useRef, useCallback } from 'react'

import { Camera, Scene, WebGLRenderer, Plane, Vector3 } from 'three'
import { Disclosure } from '@headlessui/react'

import RangeSlider from '../../interaction/RangeSlider'
import Switch from '../../interaction/Switch'

import classNames from '../../../lib/utils/classNames'


export default function Clipping(props: {
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
}) {
	const { renderer, scene, camera } = props

	// PsuedoHNE generated from a particular substack. We want to automatically
	// clip to this substack in the 3D.
	// TODO: this should be automatically read in from the tile feature JSON
	const substack = [140.8, 164.2]

	const [activeHNESubstack, setActiveHNESubstack] = useState(false)
	const [HNESubstack, setHNESubstack] = useState(substack)
	const [activeClippingPlanes, setActiveClippingPlanes] = useState(new Set())

	const clippingPlanes = useRef({
		x: [
			new Plane(new Vector3(1, 0, 0), 0),
			new Plane(new Vector3(-1, 0, 0), 50),
		],
		y: [
			new Plane(new Vector3(0, 1, 0), 75),
			new Plane(new Vector3(0, -1, 0), 500),
		],
		z: [
			new Plane(new Vector3(0, 0, 1), 10),
			new Plane(new Vector3(0, 0, -1), 600),
		],
	})

	const renderClippingPlanes = useCallback(() => {
		const planes: Plane[] = []
		activeClippingPlanes.forEach((p) =>
			planes.push(...clippingPlanes.current[p])
		)

		renderer.clippingPlanes = planes
		renderer.render(scene, camera)
	}, [activeClippingPlanes, renderer, scene, camera])

	useEffect(() => {
		if (renderer) renderClippingPlanes()
	}, [renderer, renderClippingPlanes])

	const onXClippingPlaneUpdate = (values) => {
		clippingPlanes.current.x[0].constant = -values[0]
		;[, clippingPlanes.current.x[1].constant] = values

		// We're only viewing the H&E Substack if both top and bottom plane constants
		// are at specific values
		if (
			values[0] === substack[0] &&
			values[1] === substack[1] &&
			activeClippingPlanes.has('x')
		) {
			setActiveHNESubstack(true)
		} else setActiveHNESubstack(false)

		renderClippingPlanes()
	}

	const onYClippingPlaneUpdate = (values) => {
		clippingPlanes.current.y[0].constant = -values[0]
		;[, clippingPlanes.current.y[1].constant] = values
		renderClippingPlanes()
	}

	const onZClippingPlaneUpdate = (values) => {
		clippingPlanes.current.z[0].constant = -values[0]
		;[, clippingPlanes.current.z[1].constant] = values
		renderClippingPlanes()
	}

	const toggleClippingPlanes = (axis: string) => {
		const active = activeClippingPlanes

		if (active.has(axis)) active.delete(axis)
		else active.add(axis)
		setActiveClippingPlanes(new Set(active))

		renderClippingPlanes()
	}

	useEffect(() => {
		if (!activeClippingPlanes.has('x')) setActiveHNESubstack(false)
	}, [activeClippingPlanes])

	const toggleHNEPlane = () => {
		const state = activeHNESubstack
		const active = activeClippingPlanes

		if (state) {
			active.delete('x')
			setActiveHNESubstack(false)
		} else {
			active.add('x')
			setActiveHNESubstack(true)
		}

		setActiveClippingPlanes(new Set(active))
		setHNESubstack(substack)
		renderClippingPlanes()
	}

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
						Clipping
					</Disclosure.Button>
					<Disclosure.Panel className="relative">
						<div className="mx-4 flex my-2 justify-between">
							<div>H&E Substack</div>
							<Switch onChange={toggleHNEPlane} enabled={activeHNESubstack} />
						</div>

						{/*
							TODO: make the min/max value for these sliders be dynamic to 
										model dimensions.
						*/}
						<div className="mx-4 flex items-center">
							<div className="mr-4">x</div>
							<Switch
								onChange={() => {
									toggleClippingPlanes('x')
									if (activeHNESubstack) setActiveHNESubstack(false)
								}}
								enabled={activeClippingPlanes.has('x')}
							/>
							<RangeSlider
								minValue={-10}
								maxValue={200}
								defaultValue={substack}
								step={(250 - -10) / 100}
								aria-label="adjust x clipping planes"
								onValuesUpdate={onXClippingPlaneUpdate}
								externalValues={HNESubstack}
							/>
						</div>

						<div className="mx-4 flex items-center">
							<div className="mr-4">y</div>
							<Switch
								onChange={() => toggleClippingPlanes('y')}
								enabled={activeClippingPlanes.has('y')}
							/>
							<RangeSlider
								minValue={-75}
								maxValue={500}
								defaultValue={[-75, 500]}
								step={10}
								aria-label="adjust y clipping planes"
								onValuesUpdate={onYClippingPlaneUpdate}
							/>
						</div>

						<div className="mx-4 mb-2 flex items-center ">
							<div className="mr-4">z</div>
							<Switch
								onChange={() => toggleClippingPlanes('z')}
								enabled={activeClippingPlanes.has('z')}
							/>
							<RangeSlider
								minValue={-10}
								maxValue={600}
								defaultValue={[-10, 600]}
								step={10}
								aria-label="adjust z clipping planes"
								onValuesUpdate={onZClippingPlaneUpdate}
							/>
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}
