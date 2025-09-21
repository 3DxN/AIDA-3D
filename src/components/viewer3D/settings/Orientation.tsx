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
	Mesh,
} from 'three'

function classNames(...classes) {
	return classes.filter(Boolean).join(' ')
}

const Orientation = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
	featureData: any
}) => {
	const { content, scene, camera, renderer, featureData } = props

	const [orientationsActive, setOrientationsActive] = useState(false)
	const [showOrientationInfo, setShowOrientationInfo] = useState(false)
	const [nucleiVisibilityKey, setNucleiVisibilityKey] = useState(0)

	// Monitor nucleus visibility changes to update axes
	useEffect(() => {
		if (content) {
			const checkVisibility = () => {
				setNucleiVisibilityKey(prev => prev + 1)
			}
			
			// Check every 100ms for visibility changes - this ensures axes update when filters change
			const interval = setInterval(checkVisibility, 100)
			
			return () => clearInterval(interval)
		}
	}, [content])

	// Toggle nucleus visibility and update axes visibility based on nucleus visibility
	useEffect(() => {
		if (content) {
			// Lines are now direct children of the scene
			scene.traverse((object) => {
				if (object.name.includes('orientation')) {
					// Check if this axis belongs to a visible nucleus
					const nucleusIndex = object.name.split('-')[0]
					const nucleus = content.children.find(child => 
						child.name === `nucleus_${nucleusIndex}`
					) as Mesh
					
					// Axis is visible only if orientationsActive is true AND the nucleus is visible
					object.visible = orientationsActive && nucleus && nucleus.visible
				}
			})

			// Make nuclei transparent when axes are shown
			content.traverse((object) => {
				if ((object as THREE.Mesh).isMesh && object.name.includes('nucleus')) {
					const mesh = object as THREE.Mesh
					const material = mesh.material as THREE.MeshStandardMaterial
					material.transparent = orientationsActive
					material.opacity = orientationsActive ? 0.2 : 1.0
				}
			})

			renderer.render(scene, camera)
		}
	}, [orientationsActive, content, scene, renderer, camera, nucleiVisibilityKey])

	// Draw orientations
	useEffect(() => {
		if (featureData && content && featureData.labels) {
			// Remove previous orientation lines from the SCENE
			const toRemove: THREE.Object3D[] = []
			scene.traverse((object) => {
				if (object.name.includes('orientation')) {
					toRemove.push(object)
				}
			})
			toRemove.forEach((child) => scene.remove(child))

			const xMaterial = new LineBasicMaterial({ color: 'red', linewidth: 3 })
			const yMaterial = new LineBasicMaterial({ color: 'green', linewidth: 3 })
			const zMaterial = new LineBasicMaterial({ color: 'blue', linewidth: 3 })

			const nuclei = content.children.filter((child) =>
				child.name.includes('nucleus')
			) as Mesh[]

			let hasOrientationData = false

			nuclei.forEach((nucleus) => {
				// Skip drawing for nuclei that have been filtered out by other controls
				if (!nucleus.visible) {
					return
				}

				const nucleusIndex = parseInt(nucleus.name.split('_')[1], 10)
				const nucleusData = featureData.labels.find(
					(d: any) => d.nucleus_index === nucleusIndex
				)

				if (nucleusData && nucleusData.axes && nucleusData.orientation) {
					hasOrientationData = true

					// Get the world transformation matrix of the parent 'content' group
					const contentMatrixWorld = content.matrixWorld

					// Calculate the nucleus center in WORLD coordinates
					let c: Vector3
					if (nucleusData.center) {
						// If center is in properties, transform it from voxel-space to world-space
						c = new Vector3(...nucleusData.center).applyMatrix4(
							contentMatrixWorld
						)
					} else {
						// Fallback: get the geometric center (in voxel-space) and transform it to world-space
						if (nucleus.geometry.boundingSphere === null) {
							nucleus.geometry.computeBoundingSphere()
						}
						c = nucleus.geometry.boundingSphere!.center
							.clone()
							.applyMatrix4(contentMatrixWorld)
					}

					const a = nucleusData.orientation
					const r = nucleusData.axes

					if (c && a && r) {
						const addLine = (
							axisIndex: number,
							material: THREE.LineBasicMaterial,
							axisLabel: string
						) => {
							const points = []
							// Orientation vectors are directions; they don't need translation but should be rotated if the group is.
							const axisVector = new Vector3(
								a[0][axisIndex],
								a[1][axisIndex],
								a[2][axisIndex]
							)
							// We only apply rotation part of the matrix to the direction vector
							axisVector.transformDirection(contentMatrixWorld)

							const scaledAxis = axisVector.multiplyScalar(r[axisIndex])

							// Calculate endpoints in WORLD space
							points.push(c.clone().add(scaledAxis))
							points.push(c.clone().sub(scaledAxis))

							const geom = new BufferGeometry().setFromPoints(points)
							const line = new Line(geom, material)
							line.name = `${nucleusIndex}-orientation-${axisLabel}`
							line.visible = orientationsActive

							// Add the line directly to the SCENE
							scene.add(line)
						}

						addLine(0, xMaterial, 'x')
						addLine(1, yMaterial, 'y')
						addLine(2, zMaterial, 'z')
					}
				}
			})

			setShowOrientationInfo(!hasOrientationData)
			renderer.render(scene, camera)
		}
	}, [
		content,
		renderer,
		scene,
		camera,
		featureData,
		orientationsActive,
	])

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
						{showOrientationInfo && (
							<div className="text-xs text-gray-500 mb-2">
								Add axes/orientation info in properties to see orientation.
							</div>
						)}
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
									className={`${orientationsActive ? 'bg-teal-600' : 'bg-gray-200'
										} pointer-events-none absolute h-4 w-9 mx-auto rounded-full transition-colors ease-in-out duration-200`}
								/>
								<span
									aria-hidden="true"
									className={`${orientationsActive ? 'translate-x-5' : 'translate-x-0'
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