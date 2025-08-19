import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import * as checkPointInPolygon from 'robust-point-in-polygon';

import { generateMeshesFromVoxelDataGPU } from './algorithms/marchingCubes';
import { calculateNucleusVolume } from './algorithms/nucleusVolume';
import { calculateNucleusDiameter } from './algorithms/nucleusDiameter';
import { saveGLTF } from './gltfExporter';
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext';

// Controls and Utils
import Settings from './settings';
import Toolbar from './toolbar';
import { padToTwo, resizeRendererToDisplaySize } from './utils';

const Viewer3D = (props: {
    tile: [number, number];
    tilesUrl: string;
    polygonCoords: number[][][];
    select3D: boolean;
    setSelect3D: (select3D: boolean) => void;
}) => {
    const { tile, tilesUrl, polygonCoords, select3D, setSelect3D } = props;

    const [content, setContent] = useState<THREE.Object3D | null>(null);
    const [scene, setScene] = useState<Scene | undefined>(undefined);
    const [camera, setCamera] = useState<PerspectiveCamera | undefined>(undefined);
    const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined);
    const [controls, setControls] = useState<OrbitControls | undefined>(undefined);
    const [boundingBox, setBoundingBox] = useState<THREE.Box3 | undefined>(undefined);

    const [selectedMeshes, setSelectedMeshes] = useState<THREE.Mesh[]>([]);
    const [featureData, setFeatureData] = useState<Record<string, number>>({});

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { frame: frameBoundCellposeData } = useViewer2DData();

    // Init
    useEffect(() => {
        if (canvasRef.current) {
            const newRenderer = new THREE.WebGLRenderer({
                canvas: canvasRef.current,
                antialias: true,
                alpha: true,
            });
            newRenderer.setPixelRatio(window.devicePixelRatio);
            newRenderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
            setRenderer(newRenderer);

            const newScene = new THREE.Scene();
            const environment = new RoomEnvironment();
            const pmremGenerator = new THREE.PMREMGenerator(newRenderer);
            newScene.environment = pmremGenerator.fromScene(environment).texture;
            newScene.background = new THREE.Color(0x000000); // Set a background color
            setScene(newScene);

            const fov = 60;
            const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
            const near = 0.1;
            const far = 2000;
            const newCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
            newCamera.position.set(100, 100, 100);
            setCamera(newCamera);

            const newControls = new OrbitControls(newCamera, newRenderer.domElement);
            newControls.enableDamping = true;
            setControls(newControls);

            return () => {
                newRenderer.dispose();
                newControls.dispose();
            };
        }
    }, []);

    // Generate and render mesh from voxel data
    useEffect(() => {
        const runMarchingCubes = async () => {
            if (scene && camera && renderer && frameBoundCellposeData) {
                setIsLoading(true);

                // Clear previous content
                if (content) {
                    scene.remove(content);
                    content.traverse((object) => {
                        if (object instanceof THREE.Mesh) {
                            object.geometry.dispose();
                            object.material.dispose();
                        }
                    });
                }

                const meshDataArray = await generateMeshesFromVoxelDataGPU(frameBoundCellposeData);
                const newContentGroup = new THREE.Group();

                meshDataArray.forEach(({ label, mesh }) => {
                    mesh.name = `nucleus_${label}`;
                    newContentGroup.add(mesh);
                });

                const newBoundingBox = new THREE.Box3().setFromObject(newContentGroup);
                const center = newBoundingBox.getCenter(new THREE.Vector3());
                const size = newBoundingBox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                let cameraZ = Math.abs((maxDim / 2) * Math.tan(fov * 2));
                cameraZ *= 1.5; // zoom out a bit

                camera.position.set(center.x, center.y, center.z + cameraZ);
                const minZ = newBoundingBox.min.z;
                const cameraToFarEdge = minZ < 0 ? -minZ + size.z : size.z;
                camera.far = cameraToFarEdge * 3;
                camera.updateProjectionMatrix();

                if (controls) {
                    controls.target.set(center.x, center.y, center.z);
                    controls.update();
                }

                scene.add(newContentGroup);
                setContent(newContentGroup);
                setBoundingBox(newBoundingBox);
                renderer.render(scene, camera);
                setIsLoading(false);
            }
        };

        runMarchingCubes();
    }, [scene, camera, renderer, frameBoundCellposeData]);

    // Handle resize
    useEffect(() => {
        if (renderer && camera && canvasRef.current) {
            const handleResize = () => {
                if (canvasRef.current) {
                    const { width, height, clientWidth, clientHeight } = canvasRef.current;

                    camera.aspect = clientWidth / clientHeight;
                    camera.updateProjectionMatrix();

                    const needResize = width !== clientWidth || height !== clientHeight;
                    if (needResize) {
                        renderer.setSize(clientWidth, clientHeight, false);
                    }
                }
            };
            window.addEventListener('resize', handleResize);
            handleResize();
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [renderer, camera]);

    // Animation loop
    useEffect(() => {
        let animationFrameId: number;
        const animate = () => {
            if (renderer && scene && camera && controls) {
                controls.update();
                resizeRendererToDisplaySize(renderer);
                renderer.render(scene, camera);
                animationFrameId = requestAnimationFrame(animate);
            }
        };
        animate();
        return () => cancelAnimationFrame(animationFrameId);
    }, [renderer, scene, camera, controls]);

    return (
        <div className="relative w-full h-full">
            {isLoading && (
                <div className="absolute top-0 left-0 z-10 flex items-center justify-center w-full h-full bg-gray-800 bg-opacity-50">
                    <div className="text-white">Loading...</div>
                </div>
            )}
            {error && (
                <div className="absolute top-0 left-0 z-10 flex items-center justify-center w-full h-full bg-red-800 bg-opacity-50">
                    <div className="text-white">{error}</div>
                </div>
            )}
            <canvas ref={canvasRef} className="w-full h-full" />
            <Toolbar
                onSelect={() => setSelect3D(!select3D)}
                select3D={select3D}
                onSave={() => {
                    if (scene) saveGLTF(scene);
                }}
            />
            <Settings
                selectedMeshes={selectedMeshes}
                featureData={featureData}
                onMeshSelectionChange={(meshes) => {
                    setSelectedMeshes(meshes);
                    // Calculate and set feature data for the new selection
                    if (meshes.length > 0) {
                        const volumes = meshes.map((mesh) => calculateNucleusVolume(mesh));
                        const diameters = meshes.map((mesh) => calculateNucleusDiameter(mesh));
                        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
                        const avgDiameter = diameters.reduce((a, b) => a + b, 0) / diameters.length;
                        setFeatureData({
                            'Avg. Volume': parseFloat(avgVolume.toFixed(2)),
                            'Avg. Diameter': parseFloat(avgDiameter.toFixed(2)),
                        });
                    } else {
                        setFeatureData({});
                    }
                }}
            />
        </div>
    );
};

export default Viewer3D;