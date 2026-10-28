// src/components/viewer3D/index.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useZarrStore } from '../../lib/contexts/ZarrStoreContext';

import Settings from './settings';
import Toolbar from './toolbar';
import { resizeRendererToDisplaySize } from './utils';
import {
	type SceneLayer, createNucleusMaterial, disposeObject, clearHighlight, nucleusMeshes
} from './layers/sceneLayers';
import { loadGltfGroup } from './layers/loadGltfLayer';
import { joinStorePath, storeFileUrl } from '../../lib/utils/discoverSources';
import {
	type LabelProperties, type PropertyType, mergeProperties, fromLabelValueFormat, ensureLabels
} from '../../lib/utils/properties';

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
	const isCameraInitialized = useRef(false);
	const [filterIncompleteNuclei, setFilterIncompleteNuclei] = useState(true);

	// All layers live under worldRoot in absolute level-0 voxel coordinates.
	// The last layer is active (`content`); earlier layers are frozen.
	const worldRoot = useRef<THREE.Group | null>(null);
	const axesHelper = useRef<THREE.AxesHelper | null>(null);
	const layersRef = useRef<SceneLayer[]>([]);
	const [layers, setLayers] = useState<SceneLayer[]>([]);
	const nextLayerId = useRef(0);
	const [layerError, setLayerError] = useState<string | null>(null);


	// New label storage refs
	const globalProperties = useRef<LabelProperties[]>([]);
	const globalPropertyTypes = useRef<PropertyType[]>([]);

	const viewerRef: React.RefObject<HTMLCanvasElement> = useRef(null);

	const { frameBoundCellposeMeshData, frameBoundCellposeMeshInfo, frameCenter, frameSize, currentZSlice, cellposeScale, full3DMode } = useViewer2DData();
	const {
		msInfo, store, cellposePath, availableMeshes, setPropertiesCallback, loadCellposeData, unloadCellposeData
	} = useZarrStore();

	const updateLayers = useCallback((update: (prev: SceneLayer[]) => SceneLayer[]) => {
		layersRef.current = update(layersRef.current);
		setLayers(layersRef.current);
	}, []);

	// Merge properties in the `label-value` format into the active layer
	const mergeIntoActiveLayer = useCallback((properties: any[]) => {
		const merged = mergeProperties(
			globalProperties.current,
			globalPropertyTypes.current,
			fromLabelValueFormat(properties)
		);
		globalProperties.current = merged.properties;
		globalPropertyTypes.current = merged.types;

		setFeatureData((prevData: any) => ({
			...prevData,
			labels: [...merged.properties],
		}));
	}, []);

	// Function to handle automatic properties loading from Cellpose zarr.json
	const handleZarrProperties = useCallback((properties: any[]) => {
		console.log('📋 Loading properties from Cellpose zarr.json:', properties);

		try {
			if (!Array.isArray(properties) || properties.length === 0) {
				console.warn('Invalid or empty properties data from zarr.json');
				return;
			}

			mergeIntoActiveLayer(properties);

			console.log('✅ Successfully loaded properties from Cellpose zarr.json');

		} catch (error) {
			console.error('❌ Error loading properties from zarr.json:', error);
		}
	}, [mergeIntoActiveLayer]);

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

			const light = new THREE.AmbientLight(0x505050);
			newScene.add(light);
			const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
			newScene.add(dirLight);

			// Reflect in z direction
			const newWorldRoot = new THREE.Group();
			newWorldRoot.scale.set(1, 1, -1);
			newScene.add(newWorldRoot);
			worldRoot.current = newWorldRoot;

			// Cross-section plane marking the current Z slice, sized by the anchor effect
			const planeMesh = new THREE.Mesh(
				new THREE.PlaneGeometry(1, 1),
				new THREE.MeshBasicMaterial({
					color: 0xffffff,
					transparent: true,
					opacity: 0.3,
					side: THREE.DoubleSide
				})
			);
			planeMesh.visible = false;
			newWorldRoot.add(planeMesh);
			crossSectionPlane.current = planeMesh;

			const newAxesHelper = new THREE.AxesHelper(1);
			newAxesHelper.visible = false;
			newScene.add(newAxesHelper);
			axesHelper.current = newAxesHelper;

			newCamera.aspect = canvas.clientWidth / canvas.clientHeight;
			newCamera.updateProjectionMatrix();

			resizeRendererToDisplaySize(newRenderer, newCamera);
			window.addEventListener('resize', () =>
				resizeRendererToDisplaySize(newRenderer, newCamera)
			);
		}
	}, []);

	// Make sure every label of the active layer has properties and recompute measurements
	const updateFeatureData = useCallback((meshes: THREE.Mesh[]) => {
		globalProperties.current = ensureLabels(
			globalProperties.current,
			globalPropertyTypes.current,
			meshes.map((mesh) => Number(mesh.name.split('_')[1]))
		);

		setFeatureData({
			labels: globalProperties.current, // Sparse, sorted by label value
			segmentationConfidence: Array.from(
				{ length: meshes.length + 1 },
				() => Math.random()
			),
			nucleusDiameters: meshes.map((mesh) => calculateNucleusDiameter(mesh)),
			nucleusVolumes: meshes.map((mesh) => calculateNucleusVolume(mesh)),
		});
	}, []);

	// Fit camera clipping range and axes to everything in the scene; position the camera once
	const fitCamera = () => {
		if (!camera || !worldRoot.current) return;
		const box = new THREE.Box3().setFromObject(worldRoot.current);
		if (box.isEmpty()) return;
		const size = box.getSize(new THREE.Vector3()).length();

		// Only set camera position on first initialization, preserve user's camera state afterwards
		if (!isCameraInitialized.current) {
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
			isCameraInitialized.current = true;
		}

		// Always update camera near/far planes for proper rendering
		camera.near = size / 100;
		camera.far = size * 100;
		camera.updateProjectionMatrix();

		if (axesHelper.current) {
			// Flip z-axis to match reflected content, and flip y to keep green pointing up
			axesHelper.current.scale.set(size, -size, -size);
			axesHelper.current.visible = true;
		}
	};

	// Freeze the active layer and make `group` the new active layer.
	// Label-specific state is reset so that the UI controls only act on the new layer.
	const startLayer = useCallback((kind: SceneLayer['kind'], sourcePath: string, group: THREE.Group) => {
		const previous = layersRef.current[layersRef.current.length - 1];
		if (previous) clearHighlight(previous.group);

		globalProperties.current = [];
		globalPropertyTypes.current = [];
		setFeatureData(null);
		setSelectedNucleiIndices([]);

		worldRoot.current?.add(group);
		updateLayers((prev) => [...prev, { id: nextLayerId.current++, kind, sourcePath, group }]);
		setContent(group);
	}, [updateLayers, setSelectedNucleiIndices]);

	const addLabelsLayer = useCallback((path: string) => {
		const groupPath = joinStorePath(path);
		setLayerError(null);
		// Empty until the voxel data for the new label group arrives
		startLayer('labels', groupPath, new THREE.Group());
		// Also switches the 2D overlay to the new label group
		loadCellposeData(groupPath);
	}, [startLayer, loadCellposeData]);

	// Mesh attributes are given inline or as a JSON file in the mesh index
	const loadMeshProperties = async (properties?: string | any[]): Promise<any[]> => {
		if (!properties || !store) return [];
		if (Array.isArray(properties)) return properties;
		const response = await fetch(storeFileUrl(store, properties));
		if (!response.ok) throw new Error(`properties ${properties}: HTTP ${response.status}`);
		const data = await response.json();
		if (!Array.isArray(data)) throw new Error(`properties ${properties}: expected an array of objects`);
		return data;
	};

	const addMeshLayer = async (path: string) => {
		if (!store) return;
		const meshPath = joinStorePath(path);
		setLayerError(null);
		setIsLoading(true);
		try {
			const entry = availableMeshes.find((mesh) => mesh.path === meshPath);
			let propertiesError: string | null = null;
			const [group, properties] = await Promise.all([
				loadGltfGroup(storeFileUrl(store, meshPath)),
				// A broken attribute file should not prevent showing the mesh
				loadMeshProperties(entry?.properties).catch((error) => {
					console.error('❌ Failed to load mesh properties:', error);
					propertiesError = `Mesh loaded without attributes: ${error instanceof Error ? error.message : error}`;
					return [];
				}),
			]);
			// The newest layer drives the 2D overlay, and a mesh has no label image to outline
			unloadCellposeData();
			startLayer('gltf', meshPath, group);
			if (properties.length > 0) mergeIntoActiveLayer(properties);
			updateFeatureData(nucleusMeshes(group));
			setLayerError(propertiesError);
			fitCamera();
			if (renderer && scene && camera) renderer.render(scene, camera);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`❌ Failed to load mesh ${meshPath}:`, error);
			setLayerError(`Failed to load mesh ${meshPath}: ${message}`);
		} finally {
			setIsLoading(false);
		}
	};

	const clearScene = () => {
		layersRef.current.forEach((layer) => {
			worldRoot.current?.remove(layer.group);
			disposeObject(layer.group);
		});
		updateLayers(() => []);

		// Orientation axes are drawn directly into the scene
		scene?.children
			.filter((object) => object.name.includes('orientation'))
			.forEach((object) => scene.remove(object));

		globalProperties.current = [];
		globalPropertyTypes.current = [];
		setContent(null);
		setFeatureData(null);
		setSelectedNucleiIndices([]);
		updateNucleusColors(new Map());
		isCameraInitialized.current = false;
		if (axesHelper.current) axesHelper.current.visible = false;
		setLayerError(null);

		// Detach the label group so that moving the frame does not repopulate the scene
		unloadCellposeData();

		if (renderer && scene && camera) renderer.render(scene, camera);
	};

	// Generate meshes for the active label group from the voxel data loaded by the 2D viewer.
	// Only the active layer follows this data; frozen and glTF layers stay static.
	useEffect(() => {
		const root = worldRoot.current;
		if (!scene || !camera || !renderer || !root || !frameBoundCellposeMeshData || !frameBoundCellposeMeshInfo) return;

		// Ignore chunks still in flight from a previous label group
		const groupPath = joinStorePath(cellposePath);
		const arrayPath = joinStorePath(frameBoundCellposeMeshInfo.arrayPath);
		if (!groupPath || (arrayPath !== groupPath && !arrayPath.startsWith(`${groupPath}/`))) return;

		const active = layersRef.current[layersRef.current.length - 1];
		if (active && !(active.kind === 'labels' && active.sourcePath === groupPath)) return;

		setIsLoading(true);

		console.log('🔧 Generating meshes with voxel scale:', cellposeScale, 'origin:', frameBoundCellposeMeshInfo.origin);
		const meshDataArray = generateMeshesFromVoxelData(
			frameBoundCellposeMeshData,
			filterIncompleteNuclei,
			cellposeScale,
			frameBoundCellposeMeshInfo.origin
		);
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

			const mesh = new THREE.Mesh(geometry, createNucleusMaterial());
			mesh.name = `nucleus_${label}`;
			newContentGroup.add(mesh);
		});

		root.add(newContentGroup);
		if (active) {
			root.remove(active.group);
			disposeObject(active.group);
			updateLayers((prev) => prev.map((layer) =>
				layer.id === active.id ? { ...layer, group: newContentGroup } : layer
			));
		} else {
			// First label group (e.g. from URL parameters): keep properties already read from its metadata
			updateLayers((prev) => [...prev, { id: nextLayerId.current++, kind: 'labels', sourcePath: groupPath, group: newContentGroup }]);
		}
		setContent(newContentGroup);
		updateFeatureData(nucleusMeshes(newContentGroup));
		fitCamera();

		renderer.render(scene, camera);
		setIsLoading(false);
	// fitCamera only reads view state for the initial camera placement; it must not trigger mesh regeneration
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scene, camera, renderer, frameBoundCellposeMeshData, frameBoundCellposeMeshInfo, cellposePath, filterIncompleteNuclei, cellposeScale, updateFeatureData, updateLayers]);

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

	// Move the world so that the current frame (or the volume centre in Full 3D Mode) sits at the origin.
	// Layers are in absolute coordinates, so frozen layers stay aligned while the frame moves.
	useEffect(() => {
		const root = worldRoot.current;
		const plane = crossSectionPlane.current;
		if (!root || !plane) return;

		const useVolume = full3DMode && !!msInfo?.shape.x && !!msInfo?.shape.y;
		const [anchorX, anchorY] = useVolume ? [msInfo!.shape.x! / 2, msInfo!.shape.y! / 2] : frameCenter;
		const anchorZ = full3DMode && msInfo?.shape.z ? msInfo.shape.z / 2 : currentZSlice;
		const [width, height] = useVolume ? [msInfo!.shape.x!, msInfo!.shape.y!] : (frameSize ?? [100, 100]);

		// worldRoot is reflected in z, so a positive z offset brings anchorZ to the origin
		root.position.set(-anchorX, -anchorY, anchorZ);
		plane.position.set(anchorX, anchorY, currentZSlice);
		plane.scale.set(width, height, 1);
		plane.visible = layers.length > 0;

		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}, [full3DMode, msInfo, frameCenter, frameSize, currentZSlice, layers, renderer, scene, camera]);

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

		renderer.render(scene, camera);
	}, [featureData, content, renderer, scene, camera, updateNucleusColors, globalPropertyTypes]);

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
					featureData={featureData}
					selected={selectedMeshesState}
					setFeatureData={setFeatureData}
					globalProperties={globalProperties}
					globalPropertyTypes={globalPropertyTypes}
					filterIncompleteNuclei={filterIncompleteNuclei}
					setFilterIncompleteNuclei={setFilterIncompleteNuclei}
					layers={layers}
					layerError={layerError}
					isLoading={isLoading}
					onAddLabels={addLabelsLayer}
					onAddMesh={addMeshLayer}
					onClear={clearScene}
				/>
			</div>
		</div>
	);
};

export default Viewer3D;