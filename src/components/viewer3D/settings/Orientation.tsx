/* eslint-disable max-len */
import { useEffect, useState } from 'react'
import { Disclosure } from '@headlessui/react'
import {
	Camera,
	Scene,
	WebGLRenderer,
	Group,
	LineBasicMaterial,
	Vector3,
	BufferGeometry,
	Line,
} from 'three'

import classNames from '../../../lib/utils/classNames'


const Orientation = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
}) => {
	const { content, scene, camera, renderer, featureData } = props

	const [orientationsActive, setOrientationsActive] = useState(false)

	// Toggle nucleus visibility
	useEffect(() => {
		if (content) {
			const orientationLines = []
			content.traverse((object) => {
				if (object.name.includes('orientation')) orientationLines.push(object)
			})
			orientationLines.forEach((line) => {
				const orientationLine = line
				orientationLine.visible = orientationsActive
			})

			renderer.render(scene, camera)
		}
	}, [orientationsActive, content, renderer, scene, camera])

	// Draw orientations
	useEffect(() => {
		if (featureData && content) {
			// create materials for each line
			const xMaterial = new LineBasicMaterial({ color: 'red' })
			const yMaterial = new LineBasicMaterial({ color: 'green' })
			const zMaterial = new LineBasicMaterial({ color: 'blue' })

			const nuclei = content.children.filter((child) =>
				child.name.includes('nucleus')
			)

			const centers = featureData.nucleusEllipsoidCenters
			const axes = featureData.nucleusEllipsoidAxes
			const radii = featureData.nucleusEllipsoidRadii

			for (let i = 0; i < nuclei.length; i += 1) {
				const c = centers[i]
				const a = axes[i]
				const r = radii[i]

				// Add X line
				if (c && a && r) {
					const xPoints = []
					xPoints.push(
						new Vector3(
							c[0] + r[0] * a[0][0],
							c[1] + r[0] * a[1][0],
							c[2] + r[0] * a[2][0]
						)
					)
					xPoints.push(
						new Vector3(
							c[0] - r[0] * a[0][0],
							c[1] - r[0] * a[1][0],
							c[2] - r[0] * a[2][0]
						)
					)
					const xGeom = new BufferGeometry().setFromPoints(xPoints)
					const xLine = new Line(xGeom, xMaterial)
					xLine.name = `${i}-orientation-x`
					xLine.visible = orientationsActive

					// Add Y line
					const yPoints = []
					yPoints.push(
						new Vector3(
							c[0] + r[1] * a[0][1],
							c[1] + r[1] * a[1][1],
							c[2] + r[1] * a[2][1]
						)
					)
					yPoints.push(
						new Vector3(
							c[0] - r[1] * a[0][1],
							c[1] - r[1] * a[1][1],
							c[2] - r[1] * a[2][1]
						)
					)
					const yGeom = new BufferGeometry().setFromPoints(yPoints)
					const yLine = new Line(yGeom, yMaterial)
					yLine.name = `${i}-orientation-y`
					yLine.visible = orientationsActive

					// Add Z line
					const zPoints = []
					zPoints.push(
						new Vector3(
							c[0] + r[2] * a[0][2],
							c[1] + r[2] * a[1][2],
							c[2] + r[2] * a[2][2]
						)
					)
					zPoints.push(
						new Vector3(
							c[0] - r[2] * a[0][2],
							c[1] - r[2] * a[1][2],
							c[2] - r[2] * a[2][2]
						)
					)
					const zGeom = new BufferGeometry().setFromPoints(zPoints)
					const zLine = new Line(zGeom, zMaterial)
					zLine.name = `${i}-orientation-z`
					zLine.visible = orientationsActive

					// Add as a child of the respective nucleus mesh
					nuclei[i].add(xLine, yLine, zLine)
				}
			}

			renderer.render(scene, camera)
		}

		// Strictly speaking orientationsActive should be included in the dependencies
		// this is what the linter recommends. But we don't want this to run every
		// time that changes. Bit confusing how this should be handled. A different
		// useEffect is managing the visibility of the orientation lines.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [content, renderer, scene, camera, featureData])

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
						Orientation
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<div className="ml-2 mt-2 flex justify-between items-center">
							show axes
							<button
								type="button"
								className="ml-4 flex-shrink-0 group relative rounded-full inline-flex items-center justify-center h-5 w-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
								aria-pressed="false"
								onClick={() => setOrientationsActive((a) => !a)}
							>
								<span className="sr-only">Toggle axes visibility</span>
								<span
									aria-hidden="true"
									className="pointer-events-none absolute bg-white w-full h-full rounded-md"
								/>
								<span
									aria-hidden="true"
									className={`${
										orientationsActive ? 'bg-teal-600' : 'bg-gray-200'
									} pointer-events-none absolute h-4 w-9 mx-auto rounded-full transition-colors ease-in-out duration-200`}
								/>
								<span
									aria-hidden="true"
									className={`${
										orientationsActive ? 'translate-x-5' : 'translate-x-0'
									} pointer-events-none absolute left-0 inline-block h-5 w-5 border border-gray-200 rounded-full bg-white shadow transform ring-0 transition-transform ease-in-out duration-200`}
								/>
							</button>
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Orientation
