import { useState, useEffect, useRef } from 'react'
import {
	Camera,
	Scene,
	WebGLRenderer,
	Group,
	Vector2,
	Vector3,
	Box3,
	Raycaster,
} from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { SelectionBox } from './select/selectionBox'
import { SelectionHelper } from './select/selectionHelper'

const Tools = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
	setSelect3D: (select3D: boolean) => void
}) => {
	const { renderer, scene, camera, content, setSelect3D, setSelected } = props

	const [activeTool, setActiveTool] = useState('Orbit')
	const [orbitControls, setOrbitControls] = useState(null)
	const [selectHelper, setSelectHelper] = useState(null)
	const selectActive = useRef(false)

	

	// Toggle controls
	useEffect(() => {
		// Check whether orbit controls should be active
		if (orbitControls) orbitControls.enabled = activeTool === 'Orbit'

		if (activeTool === 'Select') {
			selectActive.current = true
			if (selectHelper) selectHelper.enabled = true
		} else {
			selectActive.current = false
			if (selectHelper) selectHelper.enabled = false
		}
	}, [activeTool, orbitControls, selectHelper])

    // Initialise orbit controls
	useEffect(() => {
		function render() {
			renderer.render(scene, camera)
		}

		if (renderer && scene && camera) {
			const newControls = new OrbitControls(camera, renderer.domElement)
			newControls.addEventListener('change', () => render()) // use if there is no animation loop

			// --- ADD THESE LINES ---
			newControls.enablePan = true;
			newControls.enableKeys = true; // this is true by default, but let's be explicit
			newControls.listenToKeyEvents(renderer.domElement);
			// ------------------------

			newControls.minDistance = 2
			newControls.maxDistance = 10
			newControls.target.set(0, 0, -0.2)
			newControls.update()

			setOrbitControls(newControls)
		}
	}, [renderer, scene, camera])

	// Update controls to orbit around the center of the object
	useEffect(() => {
		if (content && orbitControls) {
			const box = new Box3().setFromObject(content)
			const size = box.getSize(new Vector3()).length()
			const center = box.getCenter(new Vector3())

			orbitControls.target = center
			orbitControls.maxDistance = size * 10
			orbitControls.saveState()
		}
	}, [content, orbitControls])

	// Selection, modified version of the following example:
	// https://threejs.org/examples/?q=select#misc_boxselection
	// Key addition is select first mesh intersected with ray onClick.
	useEffect(() => {
		function findFirstIntersection(raycaster, pointer) {
			// Check for intersections specifically within the 'content' group, not the whole scene.
			if (content) {
				raycaster.setFromCamera(pointer, camera)
				const intersects = raycaster.intersectObject(content, true)
				if (intersects.length > 0) {
					const firstMesh = intersects.find((o) => {
						// Get the nucleus bounding sphere in world coords
						if (o.object.geometry.boundingSphere === null)
							o.object.geometry.computeBoundingSphere()
						const sphere = o.object.geometry.boundingSphere.clone()
						o.object.localToWorld(sphere.center)
						const center = sphere.center

						return (
							o.object.type === 'Mesh' &&
							o.object.visible &&
							renderer.clippingPlanes.every((plane) => {
								const dot = center.dot(plane.normal) + plane.constant < 0
								const intersects = sphere.intersectsPlane(plane)
								return !dot || intersects
							})
						)
					})

					return firstMesh
				}
			}
		}

		if (camera && scene && renderer) {
			const canvas = renderer.domElement
			const rect = canvas.getBoundingClientRect()
			const raycaster = new Raycaster()

			const selectionBox = new SelectionBox(camera, scene, renderer)
			const helper = new SelectionHelper(selectionBox, renderer, 'selectBox')
			setSelectHelper(helper)

			const onPointerDown = (event) => {
				if (selectActive.current) {
					// Indicate to the 2D viewer that we're making a new selection
					// by toggling this prop. Bit of a hack!
					setSelect3D((value) => !value)

					// Set the startPoint as a new Vector3
					selectionBox.startPoint.set(
						((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1,
						-((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1,
						0.5
					)
				}
			}

			const onPointerMove = (event) => {
				if (helper.isDown && selectActive.current) {
					selectionBox.endPoint.set(
						((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1,
						-((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1,
						0.5
					)

					setSelected(selectionBox.select())
				}
			}

			const onPointerUp = (event) => {
				if (selectActive.current) {
					const pointer = new Vector2()
					pointer.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1
					pointer.y =
						-((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1
					const firstIntersection = findFirstIntersection(raycaster, pointer)

					selectionBox.endPoint.set(
						((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1,
						-((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1,
						0.5
					)

					const allSelected = selectionBox.select()
					if (firstIntersection) allSelected.push(firstIntersection.object)
					for (const item of allSelected) item.material.emissive.set(0xffffff)
					setSelected(allSelected)
				}
			}

			canvas.addEventListener('pointerdown', onPointerDown)
			canvas.addEventListener('pointermove', onPointerMove)
			canvas.addEventListener('pointerup', onPointerUp)

			// Cleanup function on component unmount
			return () => {
				canvas.removeEventListener('pointerdown', onPointerDown)
				canvas.removeEventListener('pointermove', onPointerMove)
				canvas.removeEventListener('pointerup', onPointerUp)
			}
		}
	}, [camera, scene, renderer, setSelect3D, setSelectHelper, setSelected])

	return (
		<div className="m-1 absolute left-0 top-0 flex flex-col rounded-md pointer-events-auto border border-gray-300 bg-white shadow">
			{/* Orbit */}
			<button
				className={`${
					activeTool === 'Orbit'
						? 'text-teal-700 bg-gray-100 ring-2 ring-teal-500'
						: 'text-gray-500'
				} block border-b rounded-t-md p-2 text-sm leading-5 font-medium hover:ring-2 hover:ring-teal-500 hover:bg-gray-100 active:bg-gray-100 transition ease-in-out duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 ring-inset`}
				onClick={() => setActiveTool('Orbit')}
				aria-label="Activate orbit tool"
				title="Orbit"
				type="button"
			>
				<svg
					viewBox="0 0 24 24"
					fill="currentColor"
					className="cursor-click w-4 h-4"
				>
					<path
						fill="currentColor"
						d="M8,14.25L4.75,11H7C7.25,5.39 9.39,1 12,1C14,1 15.77,3.64 16.55,7.45C20.36,8.23 23,10 23,12C23,13.83 20.83,15.43 17.6,16.3L17.89,14.27C19.8,13.72 21,12.91 21,12C21,10.94 19.35,10 16.87,9.5C16.95,10.29 17,11.13 17,12C17,18.08 14.76,23 12,23C10.17,23 8.57,20.83 7.7,17.6L9.73,17.89C10.28,19.8 11.09,21 12,21C13.66,21 15,16.97 15,12C15,11 14.95,10.05 14.85,9.15C13.95,9.05 13,9 12,9L10.14,9.06L10.43,7.05L12,7C12.87,7 13.71,7.05 14.5,7.13C14,4.65 13.06,3 12,3C10.46,3 9.18,6.5 9,11H11.25L8,14.25M14.25,16L11,19.25V17C5.39,16.75 1,14.61 1,12C1,10.17 3.17,8.57 6.4,7.7L6.11,9.73C4.2,10.28 3,11.09 3,12C3,13.54 6.5,14.82 11,15V12.75L14.25,16Z"
					/>
				</svg>
			</button>

			{/* Select */}
			<button
				className={`${
					activeTool === 'Select'
						? 'text-teal-700 bg-gray-100 ring-2 ring-teal-500'
						: 'text-gray-500'
				} block border-b rounded-b-md p-2 text-sm leading-5 font-medium hover:ring-2 hover:ring-teal-500 hover:bg-gray-100 active:bg-gray-100 transition ease-in-out duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 ring-inset`}
				onClick={() => setActiveTool('Select')}
				aria-label="Activate select tool"
				title="Select"
				type="button"
			>
				<svg
					viewBox="0 0 24 24"
					fill="currentColor"
					className="cursor-click w-4 h-4"
				>
					<path d="M13.64,21.97C13.14,22.21 12.54,22 12.31,21.5L10.13,16.76L7.62,18.78C7.45,18.92 7.24,19 7,19A1,1 0 0,1 6,18V3A1,1 0 0,1 7,2C7.24,2 7.47,2.09 7.64,2.23L7.65,2.22L19.14,11.86C19.57,12.22 19.62,12.85 19.27,13.27C19.12,13.45 18.91,13.57 18.7,13.61L15.54,14.23L17.74,18.96C18,19.46 17.76,20.05 17.26,20.28L13.64,21.97Z" />
				</svg>
			</button>
		</div>
	)
}

export default Tools
