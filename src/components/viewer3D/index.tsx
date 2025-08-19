// src/components/viewer3D/index.tsx

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import * as checkPointInPolygon from 'robust-point-in-polygon';

// New imports for mesh generation and saving
import { generateMeshesFromVoxelDataGPU } from './algorithms/marchingCubes';
import { calculateNucleusVolume } from './algorithms/nucleusVolume';
import { calculateNucleusDiameter } from './algorithms/nucleusDiameter';
import { saveGLTF } from './gltfExporter';
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext';

// Controls and Utils (assuming these are in the same relative path)
import Settings from './settings'
import Toolbar from './toolbar'
import { padToTwo, resizeRendererToDisplaySize } from './utils'

const generateDummyCellposeData = (): number[][][] => {
	const size = 100
	const data: number[][][] = Array.from({ length: size }, () =>
		Array.from({ length: size }, () => new Array(size).fill(0))
	)

	const nuclei = [
		{ center: { x: 30, y: 50, z: 50 }, radius: 15, label: 1 },
		{ center: { x: 70, y: 50, z: 50 }, radius: 12, label: 2 },
		{ center: { x: 50, y: 75, z: 50 }, radius: 10, label: 3 },
		{ center: { x: 50, y: 25, z: 50 }, radius: 13, label: 4 },
		{ center: { x: 50, y: 50, z: 25 }, radius: 8, label: 5 },
	]

	nuclei.forEach(({ center, radius, label }) => {
		for (let z = Math.max(0, center.z - radius); z < Math.min(size, center.z + radius); z++) {
			for (let y = Math.max(0, center.y - radius); y < Math.min(size, center.y + radius); y++) {
				for (let x = Math.max(0, center.x - radius); x < Math.min(size, center.x + radius); x++) {
					const distanceSq = (x - center.x) ** 2 + (y - center.y) ** 2 + (z - center.z) ** 2
					if (distanceSq < radius ** 2) {
						data[z][y][x] = label
					}
				}
			}
		}
	})

	return data
}

const formatVoxelDataAsMatlab = (voxelData: number[][][]): string => {
	const [zSize, ySize, xSize] = [voxelData.length, voxelData[0].length, voxelData[0][0].length]

	let matlabString = `% 3D Voxel Data Matrix - Size: ${xSize}x${ySize}x${zSize} \n`
	matlabString += `% Generated on ${new Date().toISOString()} \n\n`
	matlabString += `voxelData = zeros(${zSize}, ${ySize}, ${xSize}); \n\n`

	for (let z = 0; z < zSize; z++) {
		matlabString += `% Z - slice ${z + 1} \n`
		matlabString += `voxelData(${z + 1}, :, : ) = [\n`

		for (let y = 0; y < ySize; y++) {
			matlabString += '    '
			for (let x = 0; x < xSize; x++) {
				matlabString += voxelData[z][y][x].toString().padStart(2, ' ')
				if (x < xSize - 1) matlabString += ', '
			}
			if (y < ySize - 1) {
				matlabString += ';\n'
			} else {
				matlabString += '\n'
			}
		}
		matlabString += '];\n\n'
	}

	matlabString += `% Display matrix information\n`
	matlabString += `fprintf('Voxel data loaded: %dx%dx%d matrix\\n', size(voxelData, 3), size(voxelData, 2), size(voxelData, 1)); \n`
	matlabString += `fprintf('Non-zero voxels: %d\\n', nnz(voxelData)); \n`

	return matlabString
}

const downloadMatlabFile = (content: string, filename: string = 'voxelData.m') => {
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
	const url = window.URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	window.URL.revokeObjectURL(url)
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
	select3D: boolean
	setSelect3D: (select3D: boolean) => void
}) => {
	const { tile, tilesUrl, polygonCoords, select3D, setSelect3D } = props

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

	const {
		frameBoundCellposeData
	} = useViewer2DData()

	// Init
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

	// Generate and render mesh from voxel data
	useEffect(() => {
		const runMarchingCubes = async () => {
			if (scene && camera && renderer && frameBoundCellposeData) {
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
				const voxelData = frameBoundCellposeData
				try {
					const meshDataArray = await generateMeshesFromVoxelDataGPU(voxelData);
					const newContentGroup = new THREE.Group();

					// Assuming generateMeshesFromVoxelDataGPU returns an array of { label, mesh }
					meshDataArray.forEach(({ label, mesh }) => {
						mesh.name = `nucleus_${label}`;
						newContentGroup.add(mesh);
					});

					const nucleusMeshes = newContentGroup.children as THREE.Mesh[];
					const numNuclei = nucleusMeshes.length;

					const newFeatureData = {
						labels: Array.from({ length: numNuclei + 1 }, () => new Set()),
						segmentationConfidence: Array.from({ length: numNuclei + 1 }, () => Math.random()),
						nucleusDiameters: nucleusMeshes.map(mesh => calculateNucleusDiameter(mesh)),
						nucleusVolumes: nucleusMeshes.map(mesh => calculateNucleusVolume(mesh)),
					};
					setFeatureData(newFeatureData);

					// Add the entire group of new meshes to the scene and state
					scene.add(newContentGroup)
					setContent(newContentGroup)

					// 4. Save the generated mesh locally as a .gltf file
					if (newContentGroup.children.length > 0) {
						// saveGLTF(newContentGroup, 'generated_cell.gltf');
					}

					// 5. Position camera to view the new content
					const box = new THREE.Box3().setFromObject(newContentGroup)
					const size = box.getSize(new THREE.Vector3()).length()
					const center = box.getCenter(new THREE.Vector3())

					newContentGroup.position.sub(center)

					camera.position.set(size / 1.5, size / 4.0, size / 1.5)
					camera.lookAt(0, 0, 0)

					camera.near = size / 100
					camera.far = size * 100
					camera.updateProjectionMatrix()

					const axesHelper = new THREE.AxesHelper(size)
					scene.add(axesHelper)

					renderer.render(scene, camera)
					setIsLoading(false)

				} catch (error) {
					console.error("Failed to generate mesh on GPU:", error);
					setIsLoading(false);
				}
			}
		}
		runMarchingCubes()
	}, [scene, camera, renderer, frameBoundCellposeData])

	// Update feature data
	useEffect(() => {
		if (tile) {
			const H = padToTwo(tile[0])
			const V = padToTwo(tile[1])
			const url = `${tilesUrl} / tile__H0${H}_V0${V}.tif__.json`
			fetch(url)
				.then((res) => {
					if (res.ok) return res.json()
					return Promise.resolve(null)
				})
				.then((data) => setFeatureData(data))
		}
	}, [tile, tilesUrl])

	// Adjust selections
	useEffect(() => {
		if (!polygonCoords || !polygonCoords.coords || polygonCoords.coords.length === 0) {
			if (!select3D) {
				setSelected([]);
			}
			return;
		}

		if (!polygonCoords.accumulate) {
			setSelected([]);
		}

		if (!content) return;

		const selectedNuclei: THREE.Mesh[] = [];

		content.children.forEach((child) => {
			if (child.isMesh && child.name.includes('nucleus')) {
				let match = true;
				const nucleus = child as THREE.Mesh;

				if (nucleus.geometry.boundingSphere === null)
					nucleus.geometry.computeBoundingSphere();
				const sphere = nucleus.geometry.boundingSphere.clone();
				nucleus.localToWorld(sphere.center);
				const center = sphere.center;

				if (checkPointInPolygon(polygonCoords.coords, [center.z, center.y]) > 0) {
					match = false;
				}

				if (renderer && renderer.clippingPlanes.length > 0) {
					renderer.clippingPlanes.forEach((plane) => {
						const dot = center.dot(plane.normal) + plane.constant < 0;
						const intersects = sphere.intersectsPlane(plane);
						if (dot && !intersects) match = false;
					});
				}

				if (!nucleus.visible) match = false;

				if (match) selectedNuclei.push(nucleus);
			}
		});

		setSelected(prevSelected => {
			const combined = [...prevSelected, ...selectedNuclei];
			return [...new Set(combined)];
		});

	}, [polygonCoords, content, renderer, select3D]);

	// Render selections
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
				featureData={featureData}
				selected={selected}
				setFeatureData={setFeatureData}
			/>
		</div>
	)
}

export default Viewer3D;