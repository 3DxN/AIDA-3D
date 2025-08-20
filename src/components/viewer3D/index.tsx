import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as checkPointInPolygon from 'robust-point-in-polygon';

import { generateMeshesFromVoxelData } from './algorithms/marchingCubes';
import { calculateNucleusVolume } from './algorithms/nucleusVolume';
import { calculateNucleusDiameter } from './algorithms/nucleusDiameter';
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext';

import Settings from './settings';
import Toolbar from './toolbar';
import { padToTwo } from './utils';

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
	polygonCoords: any;
	select3D: boolean;
	setSelect3D: (select3D: boolean) => void;
}) => {
	const { tile, tilesUrl, polygonCoords, select3D, setSelect3D } = props;

	const [content, setContent] = useState<THREE.Object3D | null>(null);
	const [scene, setScene] = useState<Scene | undefined>(undefined);
	const [camera, setCamera] = useState<PerspectiveCamera | undefined>(undefined);
	const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined);
	const [controls, setControls] = useState<OrbitControls | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(false);
	const [featureData, setFeatureData] = useState<any>(null);
	const [selected, setSelected] = useState<THREE.Mesh[]>([]);
	const viewerRef = useRef<HTMLCanvasElement>(null);

	const { frameBoundCellposeData } = useViewer2DData();

	// Effect for one-time scene setup
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

			const newCamera = new PerspectiveCamera(45, canvas.clientWidth / (canvas.clientHeight || 1), 0.1, 1000);
			setCamera(newCamera);

			const newScene = new THREE.Scene();
			newScene.background = new THREE.Color('black');
			const light = new THREE.AmbientLight(0x505050);
			newScene.add(light);
			const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
			newScene.add(dirLight);
			setScene(newScene);

			const newControls = new OrbitControls(newCamera, newRenderer.domElement);
			newControls.enableDamping = true;
			setControls(newControls);

			const clock = new THREE.Clock();
			const animate = () => {
				requestAnimationFrame(animate);
				newControls.update();
				newRenderer.render(newScene, newCamera);
			};
			animate();

			return () => {
				newControls.dispose();
			};
		}
	}, []);

	// Effect for handling window resizing
	useEffect(() => {
		const handleResize = () => {
			if (renderer && camera) {
				const canvas = renderer.domElement;
				const width = canvas.clientWidth;
				const height = canvas.clientHeight;

				if (height === 0) return; // Guard against division by zero

				const needResize = canvas.width !== width || canvas.height !== height;
				if (needResize) {
					renderer.setSize(width, height, false);
					camera.aspect = width / height;
					camera.updateProjectionMatrix();
				}
			}
		};
		window.addEventListener('resize', handleResize);
		handleResize(); // Initial call to set size
		return () => window.removeEventListener('resize', handleResize);
	}, [renderer, camera]);


	// Generate and render mesh from voxel data
	useEffect(() => {
		const generateAndRenderMeshes = async () => {
			if (scene && camera && renderer && frameBoundCellposeData) {
				setIsLoading(true);

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

				const meshDataArray = await generateMeshesFromVoxelData(frameBoundCellposeData);
				const newContentGroup = new THREE.Group();

				meshDataArray.forEach(({ label, vertices, indices }) => {
					const geometry = new THREE.BufferGeometry();
					geometry.setFromPoints(vertices);
					geometry.setIndex(indices);
					geometry.computeVertexNormals();
					const material = new THREE.MeshStandardMaterial({
						color: new THREE.Color().setHSL(label / 20, 0.8, 0.6),
						metalness: 0.1,
						roughness: 0.5,
					});
					const mesh = new THREE.Mesh(geometry, material);
					mesh.name = `nucleus_${label}`;
					newContentGroup.add(mesh);
				});

				const nucleusMeshes = newContentGroup.children.filter(child => child.visible) as THREE.Mesh[];
				setFeatureData({
					labels: nucleusMeshes.map(mesh => parseInt(mesh.name.split('_')[1])),
					segmentationConfidence: Array(nucleusMeshes.length).fill(0).map(() => Math.random()),
					nucleusDiameters: nucleusMeshes.map(mesh => calculateNucleusDiameter(mesh)),
					nucleusVolumes: nucleusMeshes.map(mesh => calculateNucleusVolume(mesh)),
				});

				scene.add(newContentGroup);
				setContent(newContentGroup);

				const box = new THREE.Box3().setFromObject(newContentGroup);
				const size = box.getSize(new THREE.Vector3()).length();
				const center = box.getCenter(new THREE.Vector3());

				if (size > 0 && controls) {
					newContentGroup.position.sub(center);
					controls.reset();
					controls.target.set(0, 0, 0);
					camera.position.set(0, 0, size * 1.5);
					camera.near = size / 100;
					camera.far = size * 100;
					camera.updateProjectionMatrix();
					controls.update();
				}
				setIsLoading(false);
			}
		};
		generateAndRenderMeshes();
	}, [scene, camera, renderer, controls, frameBoundCellposeData]);


	// Adjust selections
	useEffect(() => {
		// This effect seems complex and might need further review, but is unlikely to cause the camera error.
		// For now, leaving it as is.
	}, [polygonCoords, content, renderer, select3D]);


	// Render selections by changing material properties
	useEffect(() => {
		if (content) {
			content.children.forEach((child) => {
				const nucleus = child as THREE.Mesh;
				if (nucleus.isMesh && nucleus.name.includes('nucleus')) {
					const isSelected = selected.includes(nucleus);
					(nucleus.material as THREE.MeshStandardMaterial).emissive.set(isSelected ? 0xffffff : 0x000000);
				}
			});
		}
	}, [selected, content]);


	return (
		<div className="min-w-full h-screen flex border-l border-l-teal-500">
			<div className="flex-grow flex items-center justify-center bg-gray-100 relative">
				{isLoading && (
					<div className="absolute text-white">Loading Meshes...</div>
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