// src/components/viewer3D/index.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import * as checkPointInPolygon from 'robust-point-in-polygon';

import { generateMeshesFromVoxelData } from './algorithms/marchingCubes';
import { calculateNucleusVolume } from './algorithms/nucleusVolume';
import { calculateNucleusDiameter } from './algorithms/nucleusDiameter';
import { createIntersectionLines, disposeIntersectionLine } from './algorithms/meshPlaneIntersection';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext';
import { useNucleusSelection } from '../../lib/contexts/NucleusSelectionContext';
import { useNucleusColor } from '../../lib/contexts/NucleusColorContext';
import { useZarrStore } from '../../lib/contexts/ZarrStoreContext';

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

// Laplacian smoothing: moves each vertex toward the average of its neighbors
const laplacianSmooth = (
	vertices: THREE.Vector3[],
	indices: number[],
	iterations: number = 1,
	lambda: number = 0.5
): THREE.Vector3[] => {
	// Build adjacency list (which vertices are connected to which)
	const neighbors: Set<number>[] = vertices.map(() => new Set());
	for (let i = 0; i < indices.length; i += 3) {
		const a = indices[i], b = indices[i + 1], c = indices[i + 2];
		neighbors[a].add(b); neighbors[a].add(c);
		neighbors[b].add(a); neighbors[b].add(c);
		neighbors[c].add(a); neighbors[c].add(b);
	}

	let current = vertices.map(v => v.clone());

	for (let iter = 0; iter < iterations; iter++) {
		const newPositions = current.map((v, i) => {
			const neighborList = neighbors[i];
			if (neighborList.size === 0) return v.clone();

			const avg = new THREE.Vector3();
			neighborList.forEach(ni => avg.add(current[ni]));
			avg.divideScalar(neighborList.size);

			// Move vertex toward neighbor average
			return v.clone().lerp(avg, lambda);
		});
		current = newPositions;
	}

	return current;
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
	const [composer, setComposer] = useState<EffectComposer | undefined>(undefined);
	const outlinePassRef = useRef<OutlinePass | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [featureData, setFeatureData] = useState<any>(null);
	const { selectedNucleiIndices, setSelectedNucleiIndices } = useNucleusSelection();
	const { updateNucleusColors } = useNucleusColor();
	const selectedMeshes = useRef<THREE.Mesh[]>([]);
	const [selectedMeshesState, setSelectedMeshesState] = useState<THREE.Mesh[]>([]);
	const crossSectionPlane = useRef<THREE.Mesh | null>(null);
	const crossSectionOutlines = useRef<Line2[]>([]);
	const [isCameraInitialized, setIsCameraInitialized] = useState(false);
	const [filterIncompleteNuclei, setFilterIncompleteNuclei] = useState(true);


	// New label storage refs
	const globalProperties = useRef<{ nucleus_index: number;[key: string]: number }[]>(
		[]
	);
	const globalPropertyTypes = useRef<{ id: number; name: string; count: number }[]>(
		[]
	);

	const viewerRef: React.RefObject<HTMLCanvasElement> = useRef(null);

	const { frameBoundCellposeMeshData, frameCenter, frameSize, getFrameBounds, currentZSlice, frameZLayersBelow, cellposeScale, full3DMode } = useViewer2DData();
	const { msInfo } = useZarrStore();
	const { setPropertiesCallback } = useZarrStore();

	// Function to handle automatic properties loading from Cellpose zarr.json
	const handleZarrProperties = useCallback((properties: any[]) => {
		console.log('📋 Loading properties from Cellpose zarr.json:', properties);

		try {
			if (!Array.isArray(properties) || properties.length === 0) {
				console.warn('Invalid or empty properties data from zarr.json');
				return;
			}

			// Transform properties to match the internal format (same logic as Export.tsx)
			const importedData = properties.map(item => {
				const { 'label-value': labelValue, ...rest } = item;
				const nucleus_index = labelValue !== undefined ? labelValue : item.nucleus_index;
				return { nucleus_index, ...rest };
			});

			// Helper function to get dimensions (from Export.tsx)
			const getDimensions = (arr: any): number[] => {
				if (!Array.isArray(arr)) return [];
				const dims: number[] = [];
				let current = arr;
				while (Array.isArray(current)) {
					dims.push(current.length);
					current = current[0];
				}
				return dims;
			};

			// Merge property types
			const newPropertyTypesMap = new Map(
				globalPropertyTypes.current.map((attr) => [attr.name, attr])
			);

			if (importedData.length > 0) {
				const sample = importedData[0];
				Object.keys(sample).forEach(key => {
					if (key !== 'nucleus_index' && !newPropertyTypesMap.has(key)) {
						const value = sample[key];
						const isArray = Array.isArray(value);
						const dimensions = isArray ? getDimensions(value) : undefined;
						const isMultiDimensional = isArray && (dimensions.length > 1 || (dimensions.length === 1 && dimensions[0] > 1));

						newPropertyTypesMap.set(key, {
							id: newPropertyTypesMap.size,
							name: key,
							count: 0,
							readOnly: false,
							dimensions: isMultiDimensional ? dimensions : undefined
						});
					}
				});
			}

			globalPropertyTypes.current = Array.from(newPropertyTypesMap.values());

			// Create a map for quick lookup of imported properties
			const importedPropertiesMap = new Map(
				importedData.map((item) => [item.nucleus_index, item])
			);

			// Create a map for quick lookup of existing properties
			const existingPropertiesMap = new Map(
				globalProperties.current.map((item) => [item.nucleus_index, item])
			);

			// Merge properties (same logic as Export.tsx)
			const maxNucleusIndex = Math.max(
				globalProperties.current.length > 0 ? globalProperties.current[globalProperties.current.length - 1].nucleus_index : -1,
				importedData.reduce((max, nucleus) => Math.max(max, nucleus.nucleus_index), -1)
			);

			const newGlobalProperties = Array.from({ length: maxNucleusIndex + 1 }, (_, i) => {
				const existingNucleus = existingPropertiesMap.get(i) || { nucleus_index: i };
				const importedNucleus = importedPropertiesMap.get(i) || { nucleus_index: i };

				const mergedNucleus = { ...existingNucleus, ...importedNucleus };

				for (const attrType of globalPropertyTypes.current) {
					if (!(attrType.name in mergedNucleus)) {
						if (attrType.dimensions) {
							const createNestedArray = (dims: number[]): any => {
								if (dims.length === 1) {
									return Array(dims[0]).fill(0);
								}
								const dim = dims[0];
								const rest = dims.slice(1);
								return Array(dim).fill(0).map(() => createNestedArray(rest));
							};
							mergedNucleus[attrType.name] = createNestedArray(attrType.dimensions);
						} else {
							mergedNucleus[attrType.name] = 0;
						}
					}
				}
				return mergedNucleus;
			});

			globalProperties.current = newGlobalProperties;

			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...newGlobalProperties],
			}));

			console.log('✅ Successfully loaded properties from Cellpose zarr.json');

		} catch (error) {
			console.error('❌ Error loading properties from zarr.json:', error);
		}
	}, [setFeatureData]);

	// Register properties callback with ZarrStore
	useEffect(() => {
		setPropertiesCallback(handleZarrProperties);
	}, [setPropertiesCallback, handleZarrProperties]);

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
			// Invert camera up vector to compensate for y-reflection
			newCamera.up.set(0, -1, 0);
			setCamera(newCamera);

			const newScene = new THREE.Scene();
			newScene.background = new THREE.Color('black');
			setScene(newScene);

			// Ambient light for base illumination
			const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
			newScene.add(ambientLight);

			// Directional light attached to camera (moves with camera view)
			const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
			dirLight.position.set(0, 0, 1);
			newCamera.add(dirLight);

			// Add camera to scene so camera-attached lights work
			newScene.add(newCamera);

			newCamera.aspect = canvas.clientWidth / canvas.clientHeight;
			newCamera.updateProjectionMatrix();

			// Set up post-processing with OutlinePass for selection visualization
			const pixelRatio = window.devicePixelRatio;
			const newComposer = new EffectComposer(newRenderer);
			newComposer.setPixelRatio(pixelRatio);
			newComposer.setSize(canvas.clientWidth, canvas.clientHeight);

			const renderPass = new RenderPass(newScene, newCamera);
			newComposer.addPass(renderPass);

			const outlinePass = new OutlinePass(
				new THREE.Vector2(canvas.clientWidth * pixelRatio, canvas.clientHeight * pixelRatio),
				newScene,
				newCamera
			);
			outlinePass.edgeStrength = 5;
			outlinePass.edgeThickness = 2;
			outlinePass.visibleEdgeColor.set(0xffffff);
			outlinePass.hiddenEdgeColor.set(0xffffff);
			outlinePass.edgeGlow = 0;
			newComposer.addPass(outlinePass);
			outlinePassRef.current = outlinePass;
			setComposer(newComposer);

			resizeRendererToDisplaySize(newRenderer, newCamera);
			window.addEventListener('resize', () => {
				resizeRendererToDisplaySize(newRenderer, newCamera);
				newComposer.setSize(canvas.clientWidth, canvas.clientHeight);
			});
		}
	}, []);

	// Generate and render mesh from voxel data
	useEffect(() => {
		if (scene && camera && renderer && frameBoundCellposeMeshData) {
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

			// Calculate the relative z position within the frameBoundCellposeData
			// In frame mode: current slice is at frameZLayersBelow index within the slice
			// In full 3D mode: we pass undefined and let the function center around the volume
			const relativeCurrentZSlice = full3DMode ? undefined : frameZLayersBelow;

			// Get total Z layers from mesh data for centering in full 3D mode
			const totalZLayers = frameBoundCellposeMeshData.shape[0];

			// Pass scale factors to ensure proper proportions at different resolutions
			console.log('🔧 Generating meshes with voxel scale:', cellposeScale, full3DMode ? '(Full 3D Mode)' : '(Frame Mode)');
			const meshDataArray = generateMeshesFromVoxelData(
				frameBoundCellposeMeshData,
				relativeCurrentZSlice,
				filterIncompleteNuclei,
				cellposeScale,
				full3DMode,
				totalZLayers
			);
			const newContentGroup = new THREE.Group();

			meshDataArray.forEach(({ label, vertices, indices }) => {
				const geometry = new THREE.BufferGeometry();

				// Apply Laplacian smoothing (2 iterations for double smoothing)
				const smoothedVertices = laplacianSmooth(vertices, indices, 2);
				const flatVertices = smoothedVertices.flatMap((v) => [v.x, v.y, v.z]);

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

			// Add cross-section plane centered at global origin facing z direction
			// In Full 3D Mode: use full data dimensions; otherwise use frame bounds
			const planeWidth = full3DMode && msInfo?.shape.x ? msInfo.shape.x : (frameSize ? frameSize[0] : 100);
			const planeHeight = full3DMode && msInfo?.shape.y ? msInfo.shape.y : (frameSize ? frameSize[1] : 100);

			if (planeWidth > 0 && planeHeight > 0) {
				// Create plane with appropriate dimensions
				const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
				const planeMaterial = new THREE.MeshBasicMaterial({
					color: 0xffffff,
					transparent: true,
					opacity: 0.3,
					side: THREE.DoubleSide
				});

				const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
				planeMesh.name = 'crossSectionPlane';

				// Position plane at global origin (0,0,0) facing z direction
				planeMesh.position.set(0, 0, 0);
				// Plane is already facing z direction by default (no rotation needed)

				newContentGroup.add(planeMesh);
				crossSectionPlane.current = planeMesh;
			}

			// Reflect in z direction
			newContentGroup.scale.set(1, 1, -1);

			scene.add(newContentGroup);
			setContent(newContentGroup);

			const box = new THREE.Box3().setFromObject(newContentGroup);
			const size = box.getSize(new THREE.Vector3()).length();

			// Don't center the content group - keep plane at global origin

			// Only set camera position on first initialization, preserve user's camera state afterwards
			if (!isCameraInitialized) {
				// Calculate camera distance to ensure everything is comfortably visible
				// In Full 3D Mode: use full data dimensions
				const effectiveWidth = full3DMode && msInfo?.shape.x ? msInfo.shape.x : (frameSize ? frameSize[0] : 100);
				const effectiveHeight = full3DMode && msInfo?.shape.y ? msInfo.shape.y : (frameSize ? frameSize[1] : 100);
				const planeSize = Math.max(effectiveWidth, effectiveHeight);

				// Zoomed in for better detail view
				const distanceScale = Math.max(2.0, planeSize / 40); // 4x more zoomed in

				// Position camera 180 degrees around (viewing from the back)
				camera.position.set(0, 0, -size * distanceScale);
				camera.lookAt(0, 0, 0);
				setIsCameraInitialized(true);
			}

			// Always update camera near/far planes for proper rendering
			camera.near = size / 100;
			camera.far = size * 100;
			camera.updateProjectionMatrix();

			const axesHelper = new THREE.AxesHelper(size);
			// Flip z-axis to match reflected content, and flip y to keep green pointing up
			axesHelper.scale.set(1, -1, -1);
			scene.add(axesHelper);

			if (composer) composer.render();
			setIsLoading(false);
		}
	}, [scene, camera, renderer, composer, frameBoundCellposeMeshData, filterIncompleteNuclei, full3DMode, msInfo, frameSize, cellposeScale]);

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
		if (renderer && scene && camera && content && composer) {
			const selectedMeshesList: THREE.Mesh[] = [];
			content.children.forEach((child) => {
				if (child.isMesh && child.name.includes('nucleus')) {
					const nucleus = child as THREE.Mesh;
					const nucleusIndex = Number(nucleus.name.split('_')[1]);
					const isSelected = selectedNucleiIndices.includes(nucleusIndex);
					if (isSelected) {
						selectedMeshesList.push(nucleus);
					}
				}
			});

			// Remove old cross-section outlines
			crossSectionOutlines.current.forEach((line) => {
				scene.remove(line);
				disposeIntersectionLine(line);
			});
			crossSectionOutlines.current = [];

			// Create new cross-section outlines (white lines where plane intersects mesh)
			// Get plane's world Z position (content group has scale.z = -1)
			let planeWorldZ = 0;
			if (crossSectionPlane.current) {
				crossSectionPlane.current.updateMatrixWorld();
				const planeWorldPos = new THREE.Vector3();
				crossSectionPlane.current.getWorldPosition(planeWorldPos);
				planeWorldZ = planeWorldPos.z;
			}
			const newOutlines: Line2[] = [];

			for (const mesh of selectedMeshesList) {
				const lines = createIntersectionLines(mesh, planeWorldZ);
				lines.forEach((line) => {
					scene.add(line);
					newOutlines.push(line);
				});
			}
			crossSectionOutlines.current = newOutlines;

			selectedMeshes.current = selectedMeshesList;
			setSelectedMeshesState(selectedMeshesList);
			composer.render();
		}
	}, [selectedNucleiIndices, renderer, scene, camera, content, composer]);

	// Update cross-section plane when frame changes
	useEffect(() => {
		if (!crossSectionPlane.current) return;

		// In Full 3D Mode: use full data dimensions; otherwise use frame bounds
		const width = full3DMode && msInfo?.shape.x ? msInfo.shape.x : (frameSize ? frameSize[0] : 100);
		const height = full3DMode && msInfo?.shape.y ? msInfo.shape.y : (frameSize ? frameSize[1] : 100);

		// Update geometry size to match appropriate dimensions
		crossSectionPlane.current.geometry.dispose();
		crossSectionPlane.current.geometry = new THREE.PlaneGeometry(width, height);

		// Keep plane at global origin (0,0,0) facing z direction (unless in full 3D mode)
		if (!full3DMode) {
			crossSectionPlane.current.position.set(0, 0, 0);
		}

		if (composer) {
			composer.render();
		}
	}, [frameCenter, frameSize, getFrameBounds, renderer, scene, camera, composer, frameBoundCellposeMeshData, full3DMode, msInfo]);

	// Update cross-section plane Z position when currentZSlice changes (Full 3D Mode only)
	// In full 3D mode, changing Z slice should move the plane without regenerating the mesh
	useEffect(() => {
		if (!full3DMode || !crossSectionPlane.current || !frameBoundCellposeMeshData || !msInfo) return;

		// Calculate plane Z position based on current slice
		// The mesh is centered at totalZLayers/2, so we need to offset accordingly
		const totalZLayers = frameBoundCellposeMeshData.shape[0];
		const volumeCenter = totalZLayers / 2;
		const zScale = cellposeScale[0];

		// currentZSlice is in full resolution coordinates - need to convert to mesh resolution
		const meshZScale = cellposeScale[0]; // z scale factor between resolutions
		const currentZInMeshCoords = currentZSlice / meshZScale;

		// Position plane at currentZSlice relative to volume center
		// Note: the scene has scale.z = -1 (reflection), so we need to account for that
		const planeZ = (currentZInMeshCoords - volumeCenter) * zScale;

		crossSectionPlane.current.position.setZ(planeZ);

		// Update cross-section outlines when plane moves
		if (scene && selectedMeshes.current.length > 0) {
			// Remove old outlines
			crossSectionOutlines.current.forEach((line) => {
				scene.remove(line);
				disposeIntersectionLine(line);
			});
			crossSectionOutlines.current = [];

			// Get plane's world Z position (content group has scale.z = -1)
			crossSectionPlane.current.updateMatrixWorld();
			const planeWorldPos = new THREE.Vector3();
			crossSectionPlane.current.getWorldPosition(planeWorldPos);
			const planeWorldZ = planeWorldPos.z;

			// Create new outlines at the new plane position
			const newOutlines: Line2[] = [];
			for (const mesh of selectedMeshes.current) {
				const lines = createIntersectionLines(mesh, planeWorldZ);
				lines.forEach((line) => {
					scene.add(line);
					newOutlines.push(line);
				});
			}
			crossSectionOutlines.current = newOutlines;
		}

		if (composer) {
			composer.render();
		}
	}, [full3DMode, currentZSlice, cellposeScale, frameBoundCellposeMeshData, msInfo, renderer, scene, camera, composer]);

	// Update colors based on labels (only as fallback when no ColorMaps are active)
	useEffect(() => {
		if (!content || !featureData?.labels || !renderer || !scene || !camera) {
			return;
		}

		// Skip default color application if there are multiple properties available for ColorMaps
		const nonRedProperties = globalPropertyTypes.current.filter(
			(propertyType) => propertyType.name !== 'red' && !propertyType.dimensions
		);
		if (nonRedProperties.length > 0) {
			console.log('🎨 Skipping default red/grey colors - ColorMaps should handle coloring');
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

		if (composer) composer.render();
	}, [featureData, content, renderer, scene, camera, composer, updateNucleusColors, globalPropertyTypes]);

	return (
		<div className="w-full h-full border-l border-l-teal-500 overflow-hidden relative">
			<div className="w-full h-full flex items-center justify-center bg-gray-100 overflow-hidden">
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
					composer={composer}
					content={content}
					setSelect3D={setSelect3D}
				/>
			)}
			<div className="absolute top-0 right-0 h-full">
				<Settings
					renderer={renderer}
					scene={scene}
					camera={camera}
					content={content}
					composer={composer}
					featureData={featureData}
					selected={selectedMeshesState}
					setFeatureData={setFeatureData}
					globalProperties={globalProperties}
					globalPropertyTypes={globalPropertyTypes}
					filterIncompleteNuclei={filterIncompleteNuclei}
					setFilterIncompleteNuclei={setFilterIncompleteNuclei}
				/>
			</div>
		</div>
	);
};

export default Viewer3D;