import { useState, useEffect, useRef } from 'react'

import * as THREE from 'three'
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'

import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

import * as checkPointInPolygon from 'robust-point-in-polygon'

// Controls
import Settings from './settings'
import Toolbar from './toolbar'

// Utils
import { padToTwo, resizeRendererToDisplaySize } from './utils'

const cleanMaterial = (material: THREE.Material) => {
	material.dispose()

	// dispose textures
	for (const key of Object.keys(material)) {
		const value = material[key]
		if (value && typeof value === 'object' && 'minFilter' in value) {
			value.dispose()
		}
	}
}

const Viewer3D = (props: {
	tile: [number, number]
	tilesUrl: string
	polygonCoords: number[][][]
	select3D: boolean // <-- Add the prop type
	setSelect3D: (select3D: boolean) => void
}) => {
	// Destructure the new prop
	const { tile, tilesUrl, polygonCoords, select3D, setSelect3D } = props

	const [content, setContent] = useState(null)
	const [scene, setScene] = useState<Scene | undefined>(undefined)
	const [camera, setCamera] = useState<PerspectiveCamera | undefined>(undefined)
	const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [featureData, setFeatureData] = useState(null)
	const [open, setOpen] = useState(false)
	// Array of selected nuclei as specified by polygon on 2D viewer
	const [selected, setSelected] = useState([])
	const selectedCache = useRef([])

	// Reference to viewer element
	const viewerRef: { current: HTMLCanvasElement | null } = useRef(null)

	// Init
	useEffect(() => {
		if (viewerRef.current) {
			// Rendering 3D tile.
			const canvas = viewerRef.current
			const newRenderer = new THREE.WebGLRenderer({
				antialias: true,
				canvas: canvas,
			})
			newRenderer.setPixelRatio(window.devicePixelRatio)
			// newRenderer.setSize(container.clientWidth, container.clientHeight)
			newRenderer.toneMapping = THREE.ACESFilmicToneMapping
			newRenderer.toneMappingExposure = 1
			newRenderer.outputEncoding = THREE.sRGBEncoding
			setRenderer(newRenderer)

			const newCamera = new THREE.PerspectiveCamera(
				45,
				canvas.clientWidth / canvas.clientHeight,
				0.25,
				20
			)
			setCamera(newCamera)

			const environment = new RoomEnvironment()
			const pmremGenerator = new THREE.PMREMGenerator(newRenderer)

			const newScene = new THREE.Scene()
			newScene.background = new THREE.Color('#f3f4f6')
			newScene.environment = pmremGenerator.fromScene(environment).texture
			setScene(newScene)

			// Lights
			// This soft white light globally illuminates all objects in the scene equally.
			const light = new THREE.AmbientLight(0x505050)
			newScene.add(light)

			newCamera.aspect = canvas.clientWidth / canvas.clientHeight
			newCamera.updateProjectionMatrix()

			resizeRendererToDisplaySize(newRenderer)
			window.addEventListener('resize', () =>
				resizeRendererToDisplaySize(newRenderer)
			)
		}
	}, [])

	// Update tile
	useEffect(() => {
		if (tile) {
			// Activate visual loading indicator
			setIsLoading(true)

			// model
			const H = padToTwo(tile[0])
			const V = padToTwo(tile[1])
			const newLoader = new GLTFLoader()

			const url = `${tilesUrl}/tile__H0${H}_V0${V}.tif__.gltf`

			if (scene) {
				scene.clear()

				// Also need to clear the objects from memory to avoid leak.
				scene.traverse((object) => {
					if (!object.isMesh) return
					object.geometry.dispose()

					if (object.material.isMaterial) {
						cleanMaterial(object.material)
					} else {
						// an array of materials
						for (const material of object.material) cleanMaterial(material)
					}
				})
			}

			newLoader.load(url, (gltf) => {
				// Deactivate loading indicator
				setIsLoading(false)

				const newContent = gltf.scene
				// Ensure every mesh has a unique material instance to allow for
				// individual color and emissive changes.
				newContent.traverse((object) => {
					if (object.isMesh) {
						// Clone the material to make it unique
						const newMaterial = object.material.clone();

						// Set the color to a darker grey
						newMaterial.color.setHex(0x808080);

						object.material = newMaterial;
					}
				});
				scene.add(newContent);
				setContent(newContent);

				// The model is orientated poorly, doesn't match up with the 2D
				// Do some manual rotations/reflections in order to algin correctly.

				// TODO: Remove following hack.
				// HACK: this specific example tile model from CellPose is orientated
				//       differently from the rest. Need to reorient it. This should be
				//       temporary until the 3D models are all consistent.
				if (H === '12' && V === '11') {
					newContent.applyMatrix4(new THREE.Matrix4().makeScale(1, -1, 1))
					newContent.rotateX(Math.PI / 2)
					newContent.rotateZ(Math.PI / 2)
					newContent.rotateY(Math.PI)
					newContent.translateZ(-460)
				} else {
					// Reflect on y-axis
					newContent.applyMatrix4(new THREE.Matrix4().makeScale(1, -1, 1))
					newContent.rotateX(Math.PI / 2)
					newContent.rotateZ(Math.PI / 2)
					newContent.rotateY(Math.PI)
					newContent.translateZ(-302)
				}

				// Setup the space for the new object
				// This is from three-gltf-viewer
				const box = new THREE.Box3().setFromObject(newContent)
				const size = box.getSize(new THREE.Vector3()).length()
				const center = box.getCenter(new THREE.Vector3())

				const midX = (box.max.x - box.min.x) / 2
				const midY = (box.max.y - box.min.y) / 2
				const midZ = (box.max.z - box.min.z) / 2

				camera.near = size / 100
				camera.far = size * 100

				// Currently set by trial an error
				// TODO: should be programmatic, set distance from model dynamically
				//       based on model size.
				const cameraPos = scene.localToWorld(
					new THREE.Vector3(-1500, midY, midZ)
				)
				camera.position.copy(cameraPos)
				camera.lookAt(center)
				camera.updateProjectionMatrix()

				// Axes helper
				const axesHelper = new THREE.AxesHelper(1000)
				scene.add(axesHelper)

				renderer.render(scene, camera)
			})
		}
	}, [tile, camera, scene, renderer, tilesUrl])

	// Update feature data
	useEffect(() => {
		if (tile) {
			const H = padToTwo(tile[0])
			const V = padToTwo(tile[1])
			const url = `${tilesUrl}/tile__H0${H}_V0${V}.tif__.json`

			fetch(url).then((featureDataFile) => {
				featureDataFile.json().then((data) => setFeatureData(data))
			})
		}
	}, [tile, tilesUrl])

	// Adjust selections from the 2D viewer
	// When new polygon coords are provided we created an extruded shape in the
	// xy plane and select all nuclei whose center intersects with the extruded
	// shape.
	useEffect(() => {
		// Exit early if there are no polygon coordinates
		if (!polygonCoords || !polygonCoords.coords || polygonCoords.coords.length === 0) {
			// If the polygon is cleared, we should also clear the selection made by it
			if (!select3D) { // select3D is a good proxy to know if the selection originated from 3D view
				setSelected([]);
			}
			return;
		}

		// NEW: Check if we should reset the selection.
		// We only reset if the 'accumulate' flag is false.
		if (!polygonCoords.accumulate) {
			setSelected([]);
		}

		const selectedNuclei = [];

		// Check if nuclei is inside polygon, if yes, set as selected
		content.children.forEach((child, index) => {
			if (child.isMesh && child.name.includes('nucleus')) {
				let match = true;
				const nucleus = child;

				// Get the nucleus bounding sphere in world coords
				if (nucleus.geometry.boundingSphere === null)
					nucleus.geometry.computeBoundingSphere();
				const sphere = nucleus.geometry.boundingSphere.clone();
				nucleus.localToWorld(sphere.center);
				const center = sphere.center;

				// Use the coordinates from our new object
				if (checkPointInPolygon(polygonCoords.coords, [center.z, center.y]) > 0) {
					match = false;
				}

				// ... (the rest of the matching logic remains the same)
				renderer.clippingPlanes.forEach((plane) => {
					const dot = center.dot(plane.normal) + plane.constant < 0;
					const intersects = sphere.intersectsPlane(plane);
					if (dot && !intersects) match = false;
				});

				if (!nucleus.visible) match = false;

				if (match) selectedNuclei.push(nucleus);
			}
		});

		// NEW: Use the functional form of setSelected to add to the previous state
		setSelected(prevSelected => {
			const combined = [...prevSelected, ...selectedNuclei];
			// Return a unique set of nuclei to prevent duplicates
			return [...new Set(combined)];
		});

	}, [polygonCoords, content, renderer]);

	// Render selections
	useEffect(() => {
		if (renderer && scene && camera) {
			// Remove highlights from previous selection and reset cache
			selectedCache.current.forEach((nucleus) =>
				nucleus.material.emissive.set(0x000000)
			)
			selectedCache.current = selected

			// Highlight current selection
			selected.forEach((nucleus) => nucleus.material.emissive.set(0xffffff))

			renderer.render(scene, camera)
		}
	}, [selected, renderer, scene, camera])

	return (
		<div className="min-w-full h-screen flex border-l border-l-teal-500">
			<div className="flex-grow flex items-center justify-center bg-blue-500">
				{!tile && (
					<div className="absolute">
						Select a 2D tile to show the corresponding 3D segmentation
					</div>
				)}

				{isLoading && (
					<div className="absolute">
						<svg
							className="animate-spin h-5 w-5 text-teal-800"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
					</div>
				)}

				<canvas className="w-full h-full" ref={viewerRef} />
			</div>

			{tile && (
				<Toolbar
					camera={camera}
					scene={scene}
					renderer={renderer}
					content={content}
					setSelected={setSelected}
					setSelect3D={setSelect3D}
				/>
			)}

			<Settings
				renderer={renderer}
				scene={scene}
				camera={camera}
				content={content}
				tile={tile}
				featureData={featureData}
				selected={selected}
			/>
		</div>
	)
}

export default Viewer3D
