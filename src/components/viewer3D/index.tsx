import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PerspectiveCamera, Scene, WebGLRenderer, Group } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import * as checkPointInPolygon from 'robust-point-in-polygon';

import { generateMeshesFromVoxelDataGPU } from './algorithms/marchingCubes';
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext';

import Settings from './settings';
import Toolbar from './toolbar';
import { padToTwo, resizeRendererToDisplaySize } from './utils';

const cleanMaterial = (material: THREE.Material | THREE.Material[]) => {
	if (Array.isArray(material)) {
		material.forEach(cleanMaterial);
	} else {
		material.dispose();
		for (const key of Object.keys(material)) {
			const value = material[key as keyof THREE.Material];
			if (value && typeof value === 'object' && 'dispose' in value) {
				(value as any).dispose();
			}
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

	const [content, setContent] = useState<Group | null>(null);
	const [scene, setScene] = useState<Scene | undefined>(undefined);
	const [camera, setCamera] = useState<PerspectiveCamera | undefined>(undefined);
	const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(false);
	const [featureData, setFeatureData] = useState(null);
	const [selected, setSelected] = useState<THREE.Mesh[]>([]);
	const [error, setError] = useState<string | null>(null);

	const viewerRef = useRef<HTMLCanvasElement | null>(null);
	const { frameBoundCellposeData } = useViewer2DData();

	// Init Three.js scene, camera, renderer, and resize listener
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
			setRenderer(newRenderer);

			const newCamera = new PerspectiveCamera(
				45,
				canvas.clientWidth / canvas.clientHeight,
				0.1,
				2000
			);
			newCamera.position.z = 100;
			setCamera(newCamera);

			const environment = new RoomEnvironment();
			const pmremGenerator = new THREE.PMREMGenerator(newRenderer);

			const newScene = new Scene();
			newScene.background = new THREE.Color('#f3f4f6');
			newScene.environment = pmremGenerator.fromScene(environment).texture;
			setScene(newScene);

			const light = new THREE.AmbientLight(0x505050);
			newScene.add(light);
			const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
			newScene.add(dirLight);

			const handleResize = () => {
				const { clientWidth, clientHeight } = canvas;
				newCamera.aspect = clientWidth / clientHeight;
				newCamera.updateProjectionMatrix();
				newRenderer.setSize(clientWidth, clientHeight, false);
			};

			window.addEventListener('resize', handleResize);
			handleResize();

			return () => {
				window.removeEventListener('resize', handleResize);
				newRenderer.dispose();
				pmremGenerator.dispose();
			};
		}
	}, []);

	// Generate and render mesh from voxel data
	useEffect(() => {
		const runMarchingCubes = async () => {
			if (scene && camera && renderer && frameBoundCellposeData) {
				setIsLoading(true);
				setError(null);

				if (content) {
					scene.remove(content);
					content.traverse((child) => {
						if (child instanceof THREE.Mesh) {
							child.geometry.dispose();
							cleanMaterial(child.material);
						}
					});
				}

				const meshDataArray = await generateMeshesFromVoxelDataGPU(frameBoundCellposeData)
					.catch(err => {
						console.error("Error during GPU Mesh Generation:", err);
						setError("Failed to generate 3D model. Check console for details.");
						setIsLoading(false);
						return null;
					});

				if (!meshDataArray) return;

				const newContentGroup = new Group();
				meshDataArray.forEach(({ label, mesh }) => {
					mesh.name = `nucleus_${label}`;
					newContentGroup.add(mesh);
				});

				scene.add(newContentGroup);
				setContent(newContentGroup);

				const box = new THREE.Box3().setFromObject(newContentGroup);
				const size = box.getSize(new THREE.Vector3());
				const center = box.getCenter(new THREE.Vector3());
				const maxDim = Math.max(size.x, size.y, size.z);

				const fov = camera.fov * (Math.PI / 180);
				const cameraDistance = (maxDim / 2) / Math.tan(fov / 2);

				camera.position.copy(center);
				camera.position.z += cameraDistance * 1.5;
				camera.near = cameraDistance / 100;
				camera.far = cameraDistance * 2;
				camera.updateProjectionMatrix();

				renderer.render(scene, camera);
				setIsLoading(false);
			}
		};

		runMarchingCubes();
	}, [scene, camera, renderer, frameBoundCellposeData]);

	// Update feature data when tile changes
	useEffect(() => {
		if (tile && tilesUrl) {
			const H = padToTwo(tile[0]);
			const V = padToTwo(tile[1]);
			const url = `${tilesUrl}/tile__H0${H}_V0${V}.tif__.json`;
			fetch(url)
				.then((res) => (res.ok ? res.json() : Promise.resolve(null)))
				.then((data) => setFeatureData(data));
		}
	}, [tile, tilesUrl]);

	// Adjust selections based on 2D polygon drawing
	useEffect(() => {
		if (!polygonCoords?.coords?.length) {
			if (!select3D) setSelected([]);
			return;
		}

		if (!polygonCoords.accumulate) {
			setSelected([]);
		}

		if (!content) return;

		const selectedNuclei: THREE.Mesh[] = [];
		content.children.forEach((child) => {
			if (child instanceof THREE.Mesh && child.name.includes('nucleus')) {
				if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
				const sphere = child.geometry.boundingSphere!.clone();
				sphere.applyMatrix4(child.matrixWorld);

				let isVisible = child.visible;
				if (isVisible && renderer && renderer.clippingPlanes.length > 0) {
					isVisible = renderer.clippingPlanes.every(plane => plane.distanceToSphere(sphere) >= 0);
				}

				if (isVisible && checkPointInPolygon(polygonCoords.coords, [sphere.center.z, sphere.center.y]) <= 0) {
					selectedNuclei.push(child);
				}
			}
		});

		setSelected(prevSelected => {
			const newSet = new Set(polygonCoords.accumulate ? prevSelected : []);
			selectedNuclei.forEach(mesh => newSet.add(mesh));
			return Array.from(newSet);
		});

	}, [polygonCoords, content, renderer, select3D]);

	// Render selections by updating material emissive property
	useEffect(() => {
		if (content) {
			const selectedIds = new Set(selected.map(mesh => mesh.uuid));
			content.traverse((child) => {
				if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
					child.material.emissive.set(selectedIds.has(child.uuid) ? 0xffffff : 0x000000);
				}
			});
		}
	}, [selected, content]);

	// Animation loop for orbit controls and rendering
	useEffect(() => {
		let animationFrameId: number;
		const animate = () => {
			if (renderer && scene && camera) {
				renderer.render(scene, camera);
				animationFrameId = requestAnimationFrame(animate);
			}
		};
		animate();
		return () => cancelAnimationFrame(animationFrameId);
	}, [renderer, scene, camera]);

	return (
		<div className="min-w-full h-screen flex border-l border-l-teal-500">
			<div className="flex-grow flex items-center justify-center bg-gray-100 relative">
				{isLoading && (
					<div className="absolute z-10 text-white">Loading 3D Model...</div>
				)}
				{error && (
					<div className="absolute z-10 text-red-500 p-4 bg-white rounded shadow-md">{error}</div>
				)}
				<canvas className="w-full h-full" ref={viewerRef} tabIndex={-1} />
			</div>

			{camera && scene && renderer && content && (
				<Toolbar
					camera={camera}
					scene={scene}
					renderer={renderer}
					content={content}
					setSelected={setSelected}
					setSelect3D={setSelect3D}
				/>
			)}
			{camera && scene && renderer && content && (
				<Settings
					renderer={renderer}
					scene={scene}
					camera={camera}
					content={content}
					featureData={featureData}
					selected={selected}
					setFeatureData={setFeatureData}
				/>
			)}
		</div>
	);
};

export default Viewer3D;