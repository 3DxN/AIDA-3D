import { useState, useEffect, useContext, useRef } from 'react';
import * as THREE from 'three';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import * as checkPointInPolygon from 'robust-point-in-polygon';

// New imports for mesh generation and saving
import { generateMeshesFromVoxelData } from './algorithms/marchingCubes';
import { calculateNucleusVolume } from './algorithms/nucleusVolume';
import { calculateNucleusDiameter } from './algorithms/nucleusDiameter';
import { saveGLTF } from './gltfExporter';
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext';

// Controls and Utils (assuming these are in the same relative path)
import Settings from './settings'
import Toolbar from './toolbar'
import { padToTwo, resizeRendererToDisplaySize } from './utils'
import { Chunk, Uint32 } from 'zarrita';

// NEW: Helper function to generate sample multi-label voxel data (like Cellpose)
const generateDummyCellposeData = (): { data: Uint8Array; shape: [number, number, number] } => {
	const size = 100
	const shape: [number, number, number] = [size, size, size]
	const data = new Uint8Array(size * size * size).fill(0)

	// Define some "nuclei" as spheres with a center (x, y, z), a radius, and a label
	const nuclei = [
		{ center: { x: 30, y: 50, z: 50 }, radius: 15, label: 1 },
		{ center: { x: 70, y: 50, z: 50 }, radius: 12, label: 255 },
		{ center: { x: 50, y: 75, z: 50 }, radius: 10, label: 256 },
		{ center: { x: 50, y: 25, z: 50 }, radius: 13, label: 4 },
		{ center: { x: 50, y: 50, z: 25 }, radius: 8, label: 5 },
	]

	// Iterate through each nucleus definition
	nuclei.forEach(({ center, radius, label }) => {
		// Iterate through a bounding box around the nucleus to improve efficiency
		for (let z = Math.max(0, center.z - radius); z < Math.min(size, center.z + radius); z++) {
			for (let y = Math.max(0, center.y - radius); y < Math.min(size, center.y + radius); y++) {
				for (let x = Math.max(0, center.x - radius); x < Math.min(size, center.x + radius); x++) {
					// Check if the current voxel (x, y, z) is inside the sphere
					const distanceSq = (x - center.x) ** 2 + (y - center.y) ** 2 + (z - center.z) ** 2
					if (distanceSq < radius ** 2) {
						data[z * size * size + y * size + x] = label
					}
				}
			}
		}
	})

	return { data, shape }
}


// Helper function to format voxel data as MATLAB 3D matrix
const formatVoxelDataAsMatlab = (voxelData: number[][][]): string => {
	const [zSize, ySize, xSize] = [voxelData.length, voxelData[0].length, voxelData[0][0].length]

	let matlabString = `% 3D Voxel Data Matrix - Size: ${xSize}x${ySize}x${zSize} \n`
	matlabString += `% Generated on ${new Date().toISOString()} \n\n`
	matlabString += `voxelData = zeros(${zSize}, ${ySize}, ${xSize}); \n\n`

	// Format each z-slice as a 2D matrix
	for (let z = 0; z < zSize; z++) {
		matlabString += `% Z - slice ${z + 1} \n`
		matlabString += `voxelData(${z + 1}, :, : ) = [\n`

		for (let y = 0; y < ySize; y++) {
			matlabString += '    ' // Using standard spaces for indentation
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

// Helper function to download text file
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
	polygonCoords: any; // Kept as 'any' to match original provided code
	select3D: boolean
	setSelect3D: (select3D: boolean) => void
}) => {
	// Destructure the new prop
	const { tile, tilesUrl, polygonCoords, select3D, setSelect3D } = props

	const [content, setContent] = useState<THREE.Object3D | null>(null)
	const contentRef = useRef<THREE.Group | null>(null);
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
		if (scene && camera && renderer) {
			// **MODIFIED**: Encapsulate the logic in an async function to handle the WASM call.
			const runMarchingCubes = async () => {
				setIsLoading(true);

				// 1. Clear previous content using the ref
				if (contentRef.current) {
					scene.remove(contentRef.current);
					contentRef.current.traverse((object) => {
						if (!(object as THREE.Mesh).isMesh) return;
						const mesh = object as THREE.Mesh;
						mesh.geometry.dispose();
						if (Array.isArray(mesh.material)) {
							mesh.material.forEach(cleanMaterial);
						} else {
							cleanMaterial(mesh.material as THREE.Material);
						}
					});
				}

				// Get the right data source (real or dummy)
				const voxelChunk = frameBoundCellposeData
					? (frameBoundCellposeData as Chunk<Uint32>)
					: (() => {
						const dummyData = generateDummyCellposeData();
						return { data: dummyData.data, shape: dummyData.shape, stride: [dummyData.shape[1] * dummyData.shape[2], dummyData.shape[2], 1] };
					})();

				if (!voxelChunk || voxelChunk.data.length === 0) {
					// If there's no data, ensure the scene is cleared.
					// The main cleanup at the top of the useEffect handles this,
					// but this ensures we stop processing and render the empty scene.
					if (contentRef.current) {
						scene.remove(contentRef.current);
					}
					contentRef.current = null;
					setContent(null);
					renderer.render(scene, camera);
					setIsLoading(false);
					return;
				}

				const { data: sourceData, shape, stride } = voxelChunk;
				const [depth, height, width] = shape as [number, number, number];
				const flatVoxelData = new Uint8Array(depth * height * width);

				const originalLabels = [...new Set(sourceData)].filter(label => label > 0).sort((a, b) => a - b);
				const labelMap = new Map<number, number>();
				originalLabels.forEach((originalLabel, i) => {
					labelMap.set(originalLabel, i + 1);
				});

				for (let z = 0; z < depth; z++) {
					for (let y = 0; y < height; y++) {
						for (let x = 0; x < width; x++) {
							const sourceIndex = z * stride[0] + y * stride[1] + x * stride[2];
							const destIndex = z * height * width + y * width + x;
							const originalLabel = sourceData[sourceIndex];
							if (originalLabel > 0) {
								flatVoxelData[destIndex] = labelMap.get(originalLabel) || 0;
							} else {
								flatVoxelData[destIndex] = 0;
							}
						}
					}
				}

				// **MODIFIED**: 'await' the result from the async marching cubes function.
				const meshDataArray = await generateMeshesFromVoxelData(flatVoxelData, shape as [number, number, number]);

				const newContentGroup = new THREE.Group();

				meshDataArray.forEach(({ label, vertices, indices }) => {
					const geometry = new THREE.BufferGeometry();
					const flatVertices = vertices.flatMap((v) => [v.x, v.y, v.z]);
					geometry.setAttribute('position', new THREE.Float32BufferAttribute(flatVertices, 3));
					geometry.setIndex(indices);
					geometry.computeVertexNormals();
					const material = new THREE.MeshStandardMaterial({
						color: new THREE.Color().setHSL(label / 10, 0.8, 0.6),
						metalness: 0.1,
						roughness: 0.5,
					});
					const mesh = new THREE.Mesh(geometry, material);
					mesh.name = `nucleus_${label}`;
					newContentGroup.add(mesh);
				});

				const nucleusMeshes = newContentGroup.children as THREE.Mesh[];
				const numNuclei = nucleusMeshes.length;

				const newFeatureData = {
					originalNucleusIndices: originalLabels,
					labels: Array.from({ length: numNuclei + 1 }, () => new Set()),
					segmentationConfidence: Array.from({ length: numNuclei + 1 }, () => Math.random()),
					nucleusDiameters: nucleusMeshes.map(mesh => calculateNucleusDiameter(mesh)),
					nucleusVolumes: nucleusMeshes.map(mesh => calculateNucleusVolume(mesh)),
				};
				setFeatureData(newFeatureData as any); // Kept 'as any' to match original

				scene.add(newContentGroup);
				contentRef.current = newContentGroup; // Add this line
				setContent(newContentGroup);

				if (newContentGroup.children.length > 0) {
					// saveGLTF(newContentGroup, 'generated_cell.gltf');
				}

				const box = new THREE.Box3().setFromObject(newContentGroup);
				const size = box.getSize(new THREE.Vector3()).length();
				const center = box.getCenter(new THREE.Vector3());

				newContentGroup.position.sub(center);

				camera.position.set(size / 1.5, size / 4.0, size / 1.5);
				camera.lookAt(0, 0, 0);

				camera.near = size / 100;
				camera.far = size * 100;
				camera.updateProjectionMatrix();

				const axesHelper = new THREE.AxesHelper(size);
				scene.add(axesHelper);

				renderer.render(scene, camera);
				setIsLoading(false);
			};

			// **MODIFIED**: Call the new async function.
			runMarchingCubes();
		}
	}, [scene, camera, renderer, frameBoundCellposeData]);

	// --- MINIMAL CHANGES END HERE ---

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
				.then((data) => setFeatureData(data as any)) // Kept 'as any'
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
				tile={tile}
				featureData={featureData}
				selected={selected}
				setFeatureData={setFeatureData as any} // Kept 'as any'
			/>
		</div>
	)
}

export default Viewer3D;