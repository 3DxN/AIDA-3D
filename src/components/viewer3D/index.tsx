// src/Viewer3D.tsx

import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'
import * as checkPointInPolygon from 'robust-point-in-polygon'

// New imports for mesh generation and saving
import { generateMeshesFromVoxelData } from './marchingCubes'
import { saveGLTF } from './gltfExporter'

// Controls and Utils (assuming these are in the same relative path)
import Settings from './settings'
import Toolbar from './toolbar'
import { padToTwo, resizeRendererToDisplaySize } from './utils'

// Helper function to generate sample voxel data
const generateVoxelData = (): number[][][] => {
	const size = 50
	const data: number[][][] = Array.from({ length: size }, () =>
		Array.from({ length: size }, () => new Array(size).fill(0))
	)

	// Create a 10x10x10 cube (cell label 1) in the center
	const cubeSize = 10
	const offset = (size - cubeSize) / 2
	for (let z = offset; z < offset + cubeSize; z++) {
		for (let y = offset; y < offset + cubeSize; y++) {
			for (let x = offset; x < offset + cubeSize; x++) {
				data[z][y][x] = 1 // Label for cell 1
			}
		}
	}
	return data
}


const cleanMaterial = (material: THREE.Material) => {
	material.dispose()
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
	setSelect3D: (select3D: boolean) => void
}) => {
	const { tile, tilesUrl, polygonCoords, setSelect3D } = props

	const [content, setContent] = useState<THREE.Object3D | null>(null)
	const [scene, setScene] = useState<Scene | undefined>(undefined)
	const [camera, setCamera] = useState<PerspectiveCamera | undefined>(undefined)
	const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [featureData, setFeatureData] = useState(null)
	const [open, setOpen] = useState(false)
	const [selected, setSelected] = useState<THREE.Mesh[]>([])
	const selectedCache = useRef<THREE.Mesh[]>([])

	const viewerRef: { current: HTMLCanvasElement | null } = useRef(null)

	// Init (This hook remains the same)
	useEffect(() => {
		if (viewerRef.current) {
			const canvas = viewerRef.current
			const newRenderer = new THREE.WebGLRenderer({
				antialias: true,
				canvas: canvas,
			})
			newRenderer.setPixelRatio(window.devicePixelRatio)
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

			const light = new THREE.AmbientLight(0x505050)
			newScene.add(light)
			const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
			newScene.add(dirLight)

			newCamera.aspect = canvas.clientWidth / canvas.clientHeight
			newCamera.updateProjectionMatrix()

			resizeRendererToDisplaySize(newRenderer)
			window.addEventListener('resize', () =>
				resizeRendererToDisplaySize(newRenderer)
			)
		}
	}, [])

	// NEW: Generate and render mesh from voxel data
	useEffect(() => {
		if (scene && camera && renderer) {
			setIsLoading(true)

			// 1. Clear previous content
			if (content) {
				scene.remove(content)
				content.traverse((object) => {
					if (!(object as THREE.Mesh).isMesh) return
					const mesh = object as THREE.Mesh;
					mesh.geometry.dispose()
					if (Array.isArray(mesh.material)) {
						mesh.material.forEach(cleanMaterial)
					} else {
						cleanMaterial(mesh.material as THREE.Material)
					}
				})
			}

			// 2. Generate voxel data and run marching cubes
			const voxelData = generateVoxelData()
			const meshDataArray = generateMeshesFromVoxelData(voxelData)

			const newContentGroup = new THREE.Group()

			// 3. Create THREE.Mesh for each generated cell
			meshDataArray.forEach(({ label, vertices, indices }) => {
				const geometry = new THREE.BufferGeometry()

				// The vertices from marching cubes are Vector3[], flatten them for the attribute
				const flatVertices = vertices.flatMap((v) => [v.x, v.y, v.z])

				geometry.setAttribute(
					'position',
					new THREE.Float32BufferAttribute(flatVertices, 3)
				)
				geometry.setIndex(indices)
				geometry.computeVertexNormals() // Essential for correct lighting

				const material = new THREE.MeshStandardMaterial({
					color: new THREE.Color().setHSL(label / 10, 0.8, 0.6), // Give each cell a different color
					metalness: 0.1,
					roughness: 0.5,
				})

				const mesh = new THREE.Mesh(geometry, material)
				mesh.name = `nucleus_${label}` // Naming convention for selection logic
				newContentGroup.add(mesh)
			})

			scene.add(newContentGroup)
			setContent(newContentGroup)

			// 4. Save the generated mesh locally as a .gltf file
			if (newContentGroup.children.length > 0) {
				saveGLTF(newContentGroup, 'generated_cell.gltf');
			}

			// 5. Position camera to view the new content
			const box = new THREE.Box3().setFromObject(newContentGroup)
			const size = box.getSize(new THREE.Vector3()).length()
			const center = box.getCenter(new THREE.Vector3())

			// Center the group so it rotates around its origin
			newContentGroup.position.x += (newContentGroup.position.x - center.x);
			newContentGroup.position.y += (newContentGroup.position.y - center.y);
			newContentGroup.position.z += (newContentGroup.position.z - center.z);

			camera.near = size / 100
			camera.far = size * 100
			camera.position.copy(center)
			camera.position.x += size / 1.5
			camera.position.y += size / 4.0
			camera.position.z += size / 1.5
			camera.lookAt(center)
			camera.updateProjectionMatrix()

			// Axes helper for orientation
			const axesHelper = new THREE.AxesHelper(size)
			scene.add(axesHelper)

			renderer.render(scene, camera)
			setIsLoading(false)
		}
	}, [scene, camera, renderer]) // Runs once after initial setup

	// Update feature data (This hook remains the same, though may not find a file)
	useEffect(() => {
		if (tile) {
			const H = padToTwo(tile[0])
			const V = padToTwo(tile[1])
			const url = `${tilesUrl}/tile__H0${H}_V0${V}.tif__.json`
			fetch(url)
				.then((res) => {
					if (res.ok) return res.json()
					return Promise.resolve(null)
				})
				.then((data) => setFeatureData(data))
		}
	}, [tile, tilesUrl])

	// Adjust selections (This hook remains the same and will work with the new meshes)
	useEffect(() => {
		setSelected([])
		if (content && polygonCoords && polygonCoords.length > 0) {
			const selectedNuclei: THREE.Mesh[] = []

			content.children.forEach((child) => {
				if (
					(child as THREE.Mesh).isMesh &&
					child.name.includes('nucleus')
				) {
					const nucleus = child as THREE.Mesh;
					let match = true
					if (nucleus.geometry.boundingSphere === null)
						nucleus.geometry.computeBoundingSphere()
					const sphere = nucleus.geometry.boundingSphere!.clone()
					nucleus.localToWorld(sphere.center)
					const center = sphere.center

					if (checkPointInPolygon(polygonCoords, [center.z, center.y]) > 0) {
						match = false
					}
					renderer?.clippingPlanes.forEach((plane) => {
						const dot = center.dot(plane.normal) + plane.constant < 0
						const intersects = sphere.intersectsPlane(plane)
						if (dot && !intersects) match = false
					})
					if (!nucleus.visible) match = false
					if (match) selectedNuclei.push(nucleus)
				}
			})
			setSelected(selectedNuclei)
		}
	}, [polygonCoords, content, renderer])

	// Render selections (This hook remains the same)
	useEffect(() => {
		if (renderer && scene && camera) {
			selectedCache.current.forEach((nucleus) =>
				(nucleus.material as THREE.MeshStandardMaterial).emissive.set(0x000000)
			)
			selectedCache.current = selected

			selected.forEach((nucleus) =>
				(nucleus.material as THREE.MeshStandardMaterial).emissive.set(0xffffff)
			)
			renderer.render(scene, camera)
		}
	}, [selected, renderer, scene, camera])

	return (
		<div className="min-w-full h-screen flex border-l border-l-teal-500">
			<div className="flex-grow flex items-center justify-center bg-gray-100 relative">
				{!tile && !content && (
					<div className="absolute text-gray-500">
						Generating 3D model from voxel data...
					</div>
				)}
				{isLoading && (
					<div className="absolute">
						{/* SVG Loading Spinner */}
					</div>
				)}
				<canvas className="w-full h-full" ref={viewerRef} tabIndex={-1} />
			</div>

			{content && (
				<Toolbar
					camera={camera}
					scene={scene}
					renderer={renderer}
					content={content}
					setSelected={(sel) => setSelected(sel as THREE.Mesh[])}
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

export default Viewer3D;