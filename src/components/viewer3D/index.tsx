// src/components/viewer3D/index.tsx

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import * as checkPointInPolygon from 'robust-point-in-polygon';

import { generateMeshesFromVoxelData } from './algorithms/marchingCubes';
import { calculateNucleusVolume } from './algorithms/nucleusVolume';
import { calculateNucleusDiameter } from './algorithms/nucleusDiameter';
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext';
import { useNucleusSelection } from '../../lib/contexts/NucleusSelectionContext';
import { useNucleusColor } from '../../lib/contexts/NucleusColorContext';

import Settings from './settings';
import Toolbar from './toolbar';
import { padToTwo, resizeRendererToDisplaySize } from './utils';

const cleanMaterial = (material: THREE.Material) => {
	material.dispose();
	for (const key of Object.keys(material)) {
		const value = material[key as keyof THREE.Material];
		if (value && typeof value === 'object' && 'minFilter' in value) {
			(value as any).dispose();
		}
	}
};

const Viewer3D = (props: {
	tile: [number, number];
	tilesUrl: string;
	polygonCoords: any;
	select3D: boolean;
	setSelect3D: (select3D: boolean) => void;
}) => {
	const { tile, tilesUrl, polygonCoords, select3D, setSelect3D } = props;

	const [content, setContent] = useState<THREE.Object3D | null>(null);
	const [scene, setScene] = useState<Scene | undefined>(undefined);
	const [camera, setCamera] = useState<PerspectiveCamera | undefined>(
		undefined
	);
	const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(
		undefined
	);
	const [isLoading, setIsLoading] = useState(false);
	const [featureData, setFeatureData] = useState<any>(null);
	const { selectedNucleiIndices, setSelectedNucleiIndices } = useNucleusSelection();
	const { updateNucleusColors } = useNucleusColor();
	const selectedMeshes = useRef<THREE.Mesh[]>([]);
	const [selectedMeshesState, setSelectedMeshesState] = useState<THREE.Mesh[]>([]);
	const crossSectionPlane = useRef<THREE.Mesh | null>(null);
	const [isCameraInitialized, setIsCameraInitialized] = useState(false);


	// New label storage refs
	const globalProperties = useRef<{ nucleus_index: number;[key: string]: number }[]>(
		[]
	);
	const globalPropertyTypes = useRef<{ id: number; name: string; count: number }[]>(
		[]
	);

	const viewerRef: React.RefObject<HTMLCanvasElement> = useRef(null);

	const { frameBoundCellposeData, frameCenter, frameSize, getFrameBounds, currentZSlice } = useViewer2DData();

	// Init
	useEffect(() => {
		if (viewerRef.current) {
			const canvas = viewerRef.current;
			const newRenderer = new THREE.WebGLRenderer({
				antialias: true,
				canvas: canvas,
			});
			newRenderer.setPixelRatio(window.devicePixelRatio);
			newRenderer.toneMapping = THREE.ACESFilmicToneMapping;
			newRenderer.toneMappingExposure = 1;
			newRenderer.outputEncoding = THREE.sRGBEncoding;
			setRenderer(newRenderer);

			const newCamera = new THREE.PerspectiveCamera(
				45,
				canvas.clientWidth / canvas.clientHeight,
				0.25,
				20
			);
			setCamera(newCamera);

			const newScene = new THREE.Scene();
			newScene.background = new THREE.Color('black');
			setScene(newScene);

			const light = new THREE.AmbientLight(0x505050);
			newScene.add(light);
			const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
			newScene.add(dirLight);

			newCamera.aspect = canvas.clientWidth / canvas.clientHeight;
			newCamera.updateProjectionMatrix();

			resizeRendererToDisplaySize(newRenderer);
			window.addEventListener('resize', () =>
				resizeRendererToDisplaySize(newRenderer)
			);
		}
	}, []);

	// Generate and render mesh from voxel data
	useEffect(() => {
		if (scene && camera && renderer && frameBoundCellposeData) {
			setIsLoading(true);

			if (content) {
				scene.remove(content);
				content.traverse((object) => {
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

			// Clean up cross-section plane when content changes
			if (crossSectionPlane.current) {
				scene.remove(crossSectionPlane.current);
				crossSectionPlane.current.geometry.dispose();
				(crossSectionPlane.current.material as THREE.Material).dispose();
				crossSectionPlane.current = null;
			}

			const meshDataArray = generateMeshesFromVoxelData(frameBoundCellposeData);
			const newContentGroup = new THREE.Group();

			meshDataArray.forEach(({ label, vertices, indices }) => {
				const geometry = new THREE.BufferGeometry();
				const flatVertices = vertices.flatMap((v) => [v.x, v.y, v.z]);

				geometry.setAttribute(
					'position',
					new THREE.Float32BufferAttribute(flatVertices, 3)
				);
				geometry.setIndex(indices);
				geometry.computeVertexNormals();

				const material = new THREE.MeshStandardMaterial({
					color: new THREE.Color('grey'),
					metalness: 0.1,
					roughness: 0.5,
					transparent: true,
					opacity: 1.0
				});

				const mesh = new THREE.Mesh(geometry, material);
				mesh.name = `nucleus_${label}`;
				newContentGroup.add(mesh);
			});

			const nucleusMeshes = newContentGroup.children as THREE.Mesh[];

			// Find the maximum index from the newly generated meshes
			const maxNewIndex = meshDataArray.reduce(
				(max, { label }) => Math.max(max, label),
				-1
			);
			// Find the maximum index currently in memory
			const maxExistingIndex =
				globalProperties.current.length > 0
					? globalProperties.current[globalProperties.current.length - 1].nucleus_index
					: -1;
			const newSize = Math.max(maxNewIndex, maxExistingIndex);

			if (newSize > -1) {
				const currentLabelNames = globalPropertyTypes.current.map((lt) => lt.name);
				// If the new max index is larger than what we have, expand the array
				if (newSize > maxExistingIndex) {
					for (let i = maxExistingIndex + 1; i <= newSize; i++) {
						const defaultLabelState: { [key: string]: number } = {};
						currentLabelNames.forEach((name) => {
							defaultLabelState[name] = 0;
						});
						globalProperties.current.push({ nucleus_index: i, ...defaultLabelState });
					}
				}
			}

			const newFeatureData = {
				labels: globalProperties.current, // Always use the persistent, dense global array
				segmentationConfidence: Array.from(
					{ length: nucleusMeshes.length + 1 },
					() => Math.random()
				),
				nucleusDiameters: nucleusMeshes.map((mesh) =>
					calculateNucleusDiameter(mesh)
				),
				nucleusVolumes: nucleusMeshes.map((mesh) => calculateNucleusVolume(mesh)),
			};
			setFeatureData(newFeatureData);

			// Add cross-section plane to the content group so it gets the same transformations
			if (frameCenter && frameSize && frameSize[0] > 0 && frameSize[1] > 0) {
				const bounds = getFrameBounds();
				const width = bounds.right - bounds.left;
				const height = bounds.bottom - bounds.top;
				const centerX = (bounds.left + bounds.right) / 2;
				const centerY = (bounds.top + bounds.bottom) / 2;

				// Create plane using the same coordinate system as the voxel data
				const planeGeometry = new THREE.PlaneGeometry(width, height);
				const planeMaterial = new THREE.MeshBasicMaterial({
					color: 0x00ff00,
					transparent: true,
					opacity: 0.3,
					side: THREE.DoubleSide
				});

				const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

				// Position in local voxel coordinates - same as marching cubes algorithm
				// Convert from global frame coordinates to local cellpose array coordinates
				const cellposeShape = frameBoundCellposeData.shape; // [depth, height, width]

				// Center the plane based on cellpose data dimensions, same as nucleus meshes
				const cellposeCenterX = cellposeShape[2] / 2; // Center X in cellpose data
				const cellposeCenterY = cellposeShape[1] / 2; // Center Y in cellpose data
				const cellposeCenterZ = cellposeShape[0] / 2; // Center Z in cellpose data

				// Position plane at center of cellpose data coordinate system
				planeMesh.position.set(cellposeCenterX, cellposeCenterY, cellposeCenterZ);
				// Remove rotation to keep it vertical (default orientation)
				// planeMesh.rotation.x = -Math.PI / 2; // This was making it horizontal

				newContentGroup.add(planeMesh);
				crossSectionPlane.current = planeMesh;
			}

			scene.add(newContentGroup);
			setContent(newContentGroup);

			const box = new THREE.Box3().setFromObject(newContentGroup);
			const size = box.getSize(new THREE.Vector3()).length();
			const center = box.getCenter(new THREE.Vector3());

			newContentGroup.position.sub(center);

			// Only set camera position on first initialization, preserve user's camera state afterwards
			if (!isCameraInitialized) {
				camera.position.set(size / 1.5, size / 4.0, size / 1.5);
				camera.lookAt(0, 0, 0);
				setIsCameraInitialized(true);
			}

			// Always update camera near/far planes for proper rendering
			camera.near = size / 100;
			camera.far = size * 100;
			camera.updateProjectionMatrix();

			const axesHelper = new THREE.AxesHelper(size);
			scene.add(axesHelper);

			renderer.render(scene, camera);
			setIsLoading(false);
		}
	}, [scene, camera, renderer, frameBoundCellposeData]);

	// Adjust selections
	useEffect(() => {
		if (
			!polygonCoords ||
			!polygonCoords.coords ||
			polygonCoords.coords.length === 0
		) {
			if (!select3D) {
				setSelectedNucleiIndices([]);
			}
			return;
		}

		if (!polygonCoords.accumulate) {
			setSelectedNucleiIndices([]);
		}

		if (!content) return;

		const selectedNuclei: THREE.Mesh[] = [];

		content.children.forEach((child) => {
			if (child.isMesh && child.name.includes('nucleus')) {
				let match = true;
				const nucleus = child as THREE.Mesh;

				if (nucleus.geometry.boundingSphere === null)
					nucleus.geometry.computeBoundingSphere();

				const sphere = nucleus.geometry.boundingSphere!.clone();
				nucleus.localToWorld(sphere.center);
				const center = sphere.center;

				const pointsToCheck = [
					[center.z, center.y],
					[center.z + sphere.radius, center.y],
					[center.z - sphere.radius, center.y],
					[center.z, center.y + sphere.radius],
					[center.z, center.y - sphere.radius],
				];

				for (const point of pointsToCheck) {
					if (checkPointInPolygon(polygonCoords.coords, point) > 0) {
						match = false;
						break;
					}
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

		const newSelectedIndices = selectedNuclei.map(mesh => Number(mesh.name.split('_')[1]));

		setSelectedNucleiIndices(prevSelectedIndices => {
			const combined = [...prevSelectedIndices, ...newSelectedIndices];
			return [...new Set(combined)];
		});

	}, [polygonCoords, content, renderer, select3D, setSelectedNucleiIndices]);

	// Render selections
	useEffect(() => {
		if (renderer && scene && camera && content) {
			const selectedMeshesList: THREE.Mesh[] = [];
			content.children.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child as THREE.Mesh;
					const nucleusIndex = Number(nucleus.name.split('_')[1]);
					const isSelected = selectedNucleiIndices.includes(nucleusIndex);
					(nucleus.material as THREE.MeshStandardMaterial).emissive.set(
						isSelected ? 0xffffff : 0x000000
					);
					if (isSelected) {
						selectedMeshesList.push(nucleus);
					}
				}
			});

			selectedMeshes.current = selectedMeshesList;
			setSelectedMeshesState(selectedMeshesList);
			renderer.render(scene, camera);
		}
	}, [selectedNucleiIndices, renderer, scene, camera, content]);

	// Update cross-section plane when frame changes
	useEffect(() => {
		if (!crossSectionPlane.current || !frameCenter || !frameSize) return;

		// Update plane position when frame changes
		const bounds = getFrameBounds();
		const width = bounds.right - bounds.left;
		const height = bounds.bottom - bounds.top;
		const centerX = (bounds.left + bounds.right) / 2;
		const centerY = (bounds.top + bounds.bottom) / 2;

		// Update geometry size
		crossSectionPlane.current.geometry.dispose();
		crossSectionPlane.current.geometry = new THREE.PlaneGeometry(width, height);

		// Update position using cellpose data center, same as nucleus meshes
		if (frameBoundCellposeData) {
			const cellposeShape = frameBoundCellposeData.shape;
			const cellposeCenterX = cellposeShape[2] / 2;
			const cellposeCenterY = cellposeShape[1] / 2;
			const cellposeCenterZ = cellposeShape[0] / 2;
			crossSectionPlane.current.position.set(cellposeCenterX, cellposeCenterY, cellposeCenterZ);
		}

		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}, [frameCenter, frameSize, getFrameBounds, renderer, scene, camera, frameBoundCellposeData]);

	// Update colors based on labels
	useEffect(() => {
		if (!content || !featureData?.labels || !renderer || !scene || !camera) {
			return;
		}

		const redpropertyType = globalPropertyTypes.current.find(
			(propertyType) => propertyType.name === 'red'
		);
		const redPropertyName = redpropertyType ? redpropertyType.name : undefined;

		const colorMap = new Map<number, THREE.Color>();

		content.children.forEach((child) => {
			if (child.isMesh && child.name.includes('nucleus')) {
				const nucleus = child as THREE.Mesh;
				const material = nucleus.material as THREE.MeshStandardMaterial;
				const nucleusIndex = parseInt(child.name.split('_')[1], 10);
				const nucleusPropertyData = featureData.labels.find(
					(l: any) => l.nucleus_index === nucleusIndex
				);

				const targetColorHex =
					redPropertyName && nucleusPropertyData && nucleusPropertyData[redPropertyName] === 1
						? 0xff0000
						: 0x808080;

				material.color.setHex(targetColorHex);

				// Store color in the context
				colorMap.set(nucleusIndex, material.color.clone());
			}
		});

		// Update the nucleus color context
		updateNucleusColors(colorMap);

		renderer.render(scene, camera);
	}, [featureData, content, renderer, scene, camera, updateNucleusColors]);

	return (
		<div className="min-w-full h-screen flex border-l border-l-teal-500">
			<div className="flex-grow flex items-center justify-center bg-gray-100 relative">
				{!tile && !content && (
					<div className="absolute text-gray-500">
						Generating 3D model from voxel data...
					</div>
				)}
				{isLoading && (
					<div className="absolute">{/* SVG Loading Spinner */}</div>
				)}
				<canvas className="w-full h-full" ref={viewerRef} tabIndex={-1} />
			</div>

			{content && (
				<Toolbar
					camera={camera}
					scene={scene}
					renderer={renderer}
					content={content}
					setSelect3D={setSelect3D}
				/>
			)}
			<Settings
				renderer={renderer}
				scene={scene}
				camera={camera}
				content={content}
				featureData={featureData}
				selected={selectedMeshesState}
				setFeatureData={setFeatureData}
				globalProperties={globalProperties}
				globalPropertyTypes={globalPropertyTypes}
			/>
		</div>
	);
};

export default Viewer3D;