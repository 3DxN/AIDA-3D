import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useNucleusSelection } from '../../../lib/contexts/NucleusSelectionContext'

// FIX: Added missing types and the setSelected prop definition
const Tools = (props: {
	content: THREE.Group
	renderer: THREE.WebGLRenderer
	scene: THREE.Scene
	camera: THREE.Camera
	setSelect3D: (select3D: boolean) => void
}) => {
	const { renderer, scene, camera, content, setSelect3D } = props

	const [orbitControls, setOrbitControls] = useState<OrbitControls | null>(null)
	const { selectedNucleiIndices, setSelectedNucleiIndices, addSelectedNucleus, removeSelectedNucleus, clearSelection } = useNucleusSelection();


	// Initialise orbit controls
	useEffect(() => {
		if (!renderer || !scene || !camera) return

		function render() {
			renderer.render(scene, camera)
		}

		const newControls = new OrbitControls(camera, renderer.domElement)
		newControls.addEventListener('change', render)

		newControls.enablePan = true
		newControls.enableKeys = true
		newControls.listenToKeyEvents(renderer.domElement)

		newControls.minDistance = 2
		newControls.maxDistance = 10
		newControls.target.set(0, 0, -0.2)
		newControls.update()

		setOrbitControls(newControls)
		const canvas = renderer.domElement

		const preventPageZoom = (event: WheelEvent) => {
			event.preventDefault()
		}

		// The { passive: false } is important to allow preventDefault to work.
		canvas.addEventListener('wheel', preventPageZoom, { passive: false })

		// Cleanup function
		return () => {
			canvas.removeEventListener('wheel', preventPageZoom)
			newControls.dispose()
		}
	}, [renderer, scene, camera])

	// Update controls to orbit around the center of the object
	useEffect(() => {
		if (content && orbitControls) {
			const box = new THREE.Box3().setFromObject(content)
			const size = box.getSize(new THREE.Vector3()).length()
			const center = box.getCenter(new THREE.Vector3())

			orbitControls.target.copy(center)
			orbitControls.maxDistance = size * 10
			orbitControls.saveState()
		}
	}, [content, orbitControls])

	// Selection logic
	useEffect(() => {
		if (!camera || !scene || !renderer || !orbitControls || !content) return

		function findFirstIntersection(raycaster: THREE.Raycaster, pointer: THREE.Vector2) {
			raycaster.setFromCamera(pointer, camera)

			// FIX: Intersect with the 'content' group directly, not the scene's first child.
			const intersects = raycaster.intersectObject(content, true)

			if (intersects.length > 0) {
				// Find the first valid, visible mesh that is not clipped
				const firstMesh = intersects.find((o) => {
					const mesh = o.object as THREE.Mesh
					if (mesh.geometry.boundingSphere === null) {
						mesh.geometry.computeBoundingSphere()
					}
					const sphere = mesh.geometry.boundingSphere!.clone()
					mesh.localToWorld(sphere.center)
					const center = sphere.center

					const isClipped = renderer.clippingPlanes.some((plane) => {
						const dot = center.dot(plane.normal) + plane.constant < 0
						const intersectsPlane = sphere.intersectsPlane(plane)
						return dot && !intersectsPlane
					})

					return mesh.isMesh && mesh.visible && !isClipped
				})
				return firstMesh
			}
			return null
		}

		const canvas = renderer.domElement
		const raycaster = new THREE.Raycaster()
		let isDragging = false
		const mouseDownPoint = new THREE.Vector2()

		const onPointerDown = (event: PointerEvent) => {
			isDragging = false
			mouseDownPoint.set(event.clientX, event.clientY)
		}

		const onPointerMove = (event: PointerEvent) => {
			if (mouseDownPoint.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) {
				isDragging = true
			}
		}

		const onPointerUp = (event: PointerEvent) => {
			if (isDragging) {
				return // This was a drag, OrbitControls will handle it
			}

			// This was a click, handle selection
			const rect = canvas.getBoundingClientRect()
			const pointer = new THREE.Vector2()
			pointer.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1
			pointer.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1

			const firstIntersection = findFirstIntersection(raycaster, pointer)
			const clickedObject = firstIntersection ? (firstIntersection.object as THREE.Mesh) : null
			const clickedIndex = clickedObject ? Number(clickedObject.name.split('_')[1]) : null;


			setSelect3D((value) => !value)

			if (event.shiftKey) {
				// Shift-click: Add or remove from the current selection
				if (clickedIndex !== null) {
					if (selectedNucleiIndices.includes(clickedIndex)) {
						removeSelectedNucleus(clickedIndex);
					} else {
						addSelectedNucleus(clickedIndex);
					}
				}
			} else if (event.ctrlKey) {
				// Ctrl-click: Select only the last and current item (or just current if none selected)
				const lastSelected = selectedNucleiIndices.length > 0 ? selectedNucleiIndices[selectedNucleiIndices.length - 1] : null
				const newSelection = [];
				if (lastSelected !== null) newSelection.push(lastSelected);
				if (clickedIndex !== null && clickedIndex !== lastSelected) {
					newSelection.push(clickedIndex)
				}
				setSelectedNucleiIndices(newSelection);

			} else {
				// Default click: Select only the clicked object
				if (clickedIndex !== null) {
					setSelectedNucleiIndices([clickedIndex]);
				} else {
					clearSelection();
				}
			}
		}

		canvas.addEventListener('pointerdown', onPointerDown)
		canvas.addEventListener('pointermove', onPointerMove)
		canvas.addEventListener('pointerup', onPointerUp)

		return () => {
			canvas.removeEventListener('pointerdown', onPointerDown)
			canvas.removeEventListener('pointermove', onPointerMove)
			canvas.removeEventListener('pointerup', onPointerUp)
		}
	}, [camera, scene, renderer, orbitControls, content, setSelect3D, addSelectedNucleus, removeSelectedNucleus, clearSelection, selectedNucleiIndices, setSelectedNucleiIndices])

	return null
}

export default Tools