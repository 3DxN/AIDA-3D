import { useState, useEffect, useRef } from 'react';
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

// Controls and Utils
import Settings from './settings';
import Toolbar from './toolbar';
import { padToTwo, resizeRendererToDisplaySize } from './utils';

const cleanMaterial = (material: THREE.Material) => {
	material.dispose();
	for (const key of Object.keys(material)) {
		const value = material[key as keyof THREE.Material];
		if (value && typeof value === 'object' && 'dispose' in value) {
			(value as THREE.Texture).dispose();
		}
	}
};

const Viewer3D = (props: {
	tile: [number, number];
	tilesUrl: string;
	polygonCoords: any; // Using 'any' to match the provided code's implicit type
	select3D: boolean;
	setSelect3D: (select3D: boolean) => void;
}) => {
	const { tile, tilesUrl, polygonCoords, select3D, setSelect3D } = props;

	const [content, setContent] = useState<THREE.Object3D | null>(null);
	const [scene, setScene] = useState<Scene | undefined>(undefined);
	const [camera, setCamera] = useState<PerspectiveCamera | undefined>(undefined);
	const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(false);
	const [featureData, setFeatureData] = useState<any>(null); // Using 'any' for simplicity
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<THREE.Mesh[]>([]);
	const viewerRef: { current: HTMLCanvasElement | null } = useRef(null);

	const { frameBoundCellposeData } = useViewer2DData();

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
			const handleResize = () => resizeRendererToDisplaySize(newRenderer);
			window.addEventListener('resize', handleResize);

			return () => {
				window.removeEventListener('resize', handleResize);
			};
		}
	}, []);

	// --- CORRECTED MESH GENERATION LOGIC ---
	// Generate and render mesh from voxel data
	useEffect(() => {
		const generateAndRenderMeshes = async () => {
			if (scene && camera && renderer && frameBoundCellposeData) {
				setIsLoading(true);

				// 1. Clear previous content
				if (content) {
					scene.remove(content);
					content.traverse((object) => {
						const mesh = object as THREE.Mesh;
						if (!mesh.isMesh) return;
						mesh.geometry.dispose();
						if (Array.isArray(mesh.material)) {
							mesh.material.forEach(cleanMaterial);
						} else {
							cleanMaterial(mesh.material as THREE.Material);
						}
					});
				}

				// 2. Generate mesh data asynchronously
				const meshDataArray = await generateMeshesFromVoxelData(frameBoundCellposeData);
				const newContentGroup = new THREE.Group();

				// 3. Create THREE.Mesh for each generated cell
				meshDataArray.forEach(({ label, vertices, indices }) => {
					const geometry = new THREE.BufferGeometry();

					// Use setFromPoints for Vector3 array and set the index
					geometry.setFromPoints(vertices);
					geometry.setIndex(indices);
					geometry.computeVertexNormals(); // Compute normals for proper lighting

					const material = new THREE.MeshStandardMaterial({
						color: new THREE.Color().setHSL(label / 10, 0.8, 0.6),
						metalness: 0.1,
						roughness: 0.5,
					});

					const mesh = new THREE.Mesh(geometry, material);
					mesh.name = `nucleus_${label}`;
					newContentGroup.add(mesh);
				});

				// 4. Update feature data based on new meshes
				const nucleusMeshes = newContentGroup.children.filter(child => child.visible) as THREE.Mesh[];
				const numNuclei = nucleusMeshes.length;

				const newFeatureData = {
					labels: Array.from({ length: numNuclei + 1 }, (_, i) => i),
					segmentationConfidence: Array.from({ length: numNuclei + 1 }, () => Math.random()),
					nucleusDiameters: nucleusMeshes.map(mesh => calculateNucleusDiameter(mesh)),
					nucleusVolumes: nucleusMeshes.map(mesh => calculateNucleusVolume(mesh)),
				};
				setFeatureData(newFeatureData);

				scene.add(newContentGroup);
				setContent(newContentGroup);

				// 5. Position camera to view the new content
				const box = new THREE.Box3().setFromObject(newContentGroup);
				const size = box.getSize(new THREE.Vector3()).length();
				const center = box.getCenter(new THREE.Vector3());

				newContentGroup.position.sub(center); // Center the content

				camera.position.set(size / 1.5, size / 4.0, size / 1.5);
				camera.lookAt(0, 0, 0);

				camera.near = size / 100;
				camera.far = size * 100;
				camera.updateProjectionMatrix();

				const axesHelper = new THREE.AxesHelper(size);
				scene.add(axesHelper);

				renderer.render(scene, camera);
				setIsLoading(false);
			}
		};

		generateAndRenderMeshes();
	}, [scene, camera, renderer, frameBoundCellposeData]);


	// Update feature data from external source
	useEffect(() => {
		if (tile) {
			const H = padToTwo(tile[0]);
			const V = padToTwo(tile[1]);
			const url = `${tilesUrl}/tile__H0${H}_V0${V}.tif__.json`;

			fetch(url)
				.then(response => response.json())
				.then(data => setFeatureData(data))
				.catch(error => {
					console.error('Error fetching feature data:', error);
					setFeatureData(null);
				});
		}
	}, [tile, tilesUrl]);

	// Adjust selections based on polygon
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
			const nucleus = child as THREE.Mesh;
			if (nucleus.isMesh && nucleus.name.includes('nucleus')) {
				let match = true;

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

		setSelected(prevSelected => {
			const combined = [...prevSelected, ...selectedNuclei];
			return [...new Set(combined)]; // Remove duplicates
		});

	}, [polygonCoords, content, renderer, select3D]);


	// Render selections
	useEffect(() => {
		if (renderer && scene && camera && content) {
			content.children.forEach((child) => {
				const nucleus = child as THREE.Mesh;
				if (nucleus.isMesh && nucleus.name.includes('nucleus')) {
					const isSelected = selected.includes(nucleus);
					(nucleus.material as THREE.MeshStandardMaterial).emissive.set(isSelected ? 0xffffff : 0x000000);
				}
			});
			renderer.render(scene, camera);
		}
	}, [selected, renderer, scene, camera, content]);

	return (
		<div className="min-w-full h-screen flex border-l border-l-teal-500">
			<div className="flex-grow flex items-center justify-center bg-gray-100 relative">
				{!tile && !content && (
					<div className="absolute text-gray-500">
						Generating 3D model from voxel data...
					</div>
				)}
				{isLoading && (
					<div className="absolute text-white">
						Loading...
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
				setFeatureData={setFeatureData}
			/>
		</div>
	);
};

export default Viewer3D;