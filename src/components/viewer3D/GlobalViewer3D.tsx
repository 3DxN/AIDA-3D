import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useZarrStore } from '../../lib/contexts/ZarrStoreContext'
import { useViewer2DData } from '../../lib/contexts/Viewer2DDataContext'
import { useROI } from '../../lib/contexts/ROIContext'
import { resizeRendererToDisplaySize } from './utils'

export default function GlobalViewer3D() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const { msInfo } = useZarrStore()
    const { 
        frameCenter, frameSize, 
        currentZSlice, frameZLayersAbove, frameZLayersBelow,
        setFrameCenter, setZSlice 
    } = useViewer2DData()
    const { rois, roisVisible, getROIBoundingBox } = useROI()

    // Refs for Three.js objects to avoid re-creation on nav changes
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)
    
    // Content refs
    const contextBoxRef = useRef<THREE.Mesh | null>(null)
    const contextWireframeRef = useRef<THREE.LineSegments | null>(null)
    const roiGroupRef = useRef<THREE.Group | null>(null)
    
    const requestRef = useRef<number>(0)

    // 1. Initialization Effect: Sets up the scene, camera, and static global geometry
    // This ONLY runs when msInfo changes (loading a new dataset), so camera position persists during nav.
    useEffect(() => {
        if (!canvasRef.current || !msInfo) return

        const canvas = canvasRef.current
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio)
        rendererRef.current = renderer

        // Scene setup
        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#111')
        sceneRef.current = scene

        // Content Group (Match Local Viewer's coordinate system: Reflect Z)
        const contentGroup = new THREE.Group()
        contentGroup.scale.set(1, 1, -1)
        scene.add(contentGroup)

        // Dimensions
        const maxX = msInfo.shape.x
        const maxY = msInfo.shape.y
        const maxZ = msInfo.shape.z || 0
        const maxDim = Math.max(maxX, maxY, maxZ)
        const centerX = maxX / 2
        const centerY = maxY / 2
        const centerZ = maxZ / 2

        // Camera setup
        const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000000)
        camera.up.set(0, -1, 0) // Y down
        // Position at Negative Z looking at -centerZ (World Space front)
        camera.position.set(centerX, centerY, -maxDim * 2)
        camera.lookAt(centerX, centerY, -centerZ)
        cameraRef.current = camera

        // Controls
        const controls = new OrbitControls(camera, canvas)
        controls.target.set(centerX, centerY, -centerZ)
        controls.update()
        controlsRef.current = controls

        // Global Wireframe (Static)
        const globalGeo = new THREE.BoxGeometry(maxX, maxY, maxZ || 1)
        const edges = new THREE.EdgesGeometry(globalGeo)
        const globalWireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x666666 }))
        globalWireframe.position.set(centerX, centerY, centerZ)
        contentGroup.add(globalWireframe)

        // Init Context Box (Placeholder, updated in separate effect)
        const contextGeo = new THREE.BoxGeometry(1, 1, 1)
        const contextMat = new THREE.MeshBasicMaterial({ 
            color: 0xaaaaaa, 
            transparent: true, 
            opacity: 0.3, 
            depthWrite: false,
            side: THREE.DoubleSide
        })
        const contextBox = new THREE.Mesh(contextGeo, contextMat)
        contentGroup.add(contextBox)
        contextBoxRef.current = contextBox

        const contextEdges = new THREE.EdgesGeometry(contextGeo)
        const contextWireframe = new THREE.LineSegments(contextEdges, new THREE.LineBasicMaterial({ color: 0xffffff }))
        contentGroup.add(contextWireframe)
        contextWireframeRef.current = contextWireframe

        // Init ROI Group
        const roiGroup = new THREE.Group()
        contentGroup.add(roiGroup)
        roiGroupRef.current = roiGroup

        // Animation Loop
        const animate = () => {
            requestRef.current = requestAnimationFrame(animate)
            if (controlsRef.current) controlsRef.current.update()
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current)
            }
        }
        animate()

        // Cleanup
        return () => {
            cancelAnimationFrame(requestRef.current)
            renderer.dispose()
            globalGeo.dispose()
            edges.dispose()
            globalWireframe.material.dispose()
            contextGeo.dispose()
            contextMat.dispose()
            contextEdges.dispose()
            contextWireframe.material.dispose()
            
            // Clear refs to prevent leaks or stale usage
            rendererRef.current = null
            sceneRef.current = null
            cameraRef.current = null
            controlsRef.current = null
            contextBoxRef.current = null
            contextWireframeRef.current = null
            roiGroupRef.current = null
        }
    }, [msInfo])

    // 2. Update Context Box Position/Size (Runs when nav changes)
    useEffect(() => {
        if (!contextBoxRef.current || !contextWireframeRef.current) return

        const width = frameSize[0]
        const height = frameSize[1]
        const depth = frameZLayersAbove + frameZLayersBelow + 1
        
        // Use scale to adjust size (geometry is 1x1x1)
        contextBoxRef.current.scale.set(width, height, depth)
        contextWireframeRef.current.scale.set(width, height, depth)

        const zCenter = currentZSlice + (frameZLayersAbove - frameZLayersBelow) / 2
        
        contextBoxRef.current.position.set(frameCenter[0], frameCenter[1], zCenter)
        contextWireframeRef.current.position.set(frameCenter[0], frameCenter[1], zCenter)

    }, [frameCenter, frameSize, currentZSlice, frameZLayersAbove, frameZLayersBelow])

    // 3. Update ROIs & Interaction (Runs when ROIs change)
    useEffect(() => {
        if (!roiGroupRef.current || !canvasRef.current || !msInfo) return

        const roiGroup = roiGroupRef.current
        
        // Clear old ROIs safely
        while(roiGroup.children.length > 0){ 
            const child = roiGroup.children[0];
            roiGroup.remove(child); 
            if ((child as any).geometry) (child as any).geometry.dispose();
            if ((child as any).material) {
                const materials = Array.isArray((child as any).material) ? (child as any).material : [(child as any).material];
                materials.forEach((m: any) => m.dispose && m.dispose());
            }
        }

        const roiMeshes: THREE.Line[] = []

        if (roisVisible) {
            rois.forEach(roi => {
                if (roi.vertices.length < 2) return
                
                const points = roi.vertices.map(v => new THREE.Vector3(v.x, v.y, roi.zSlice))
                points.push(points[0])
                
                const roiGeo = new THREE.BufferGeometry().setFromPoints(points)
                const roiMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 }) 
                const roiLine = new THREE.Line(roiGeo, roiMat)
                roiLine.userData = { roi }
                
                roiGroup.add(roiLine)
                roiMeshes.push(roiLine)
            })
        }

        // Setup Raycasting for clicks
        const canvas = canvasRef.current
        const raycaster = new THREE.Raycaster()
        const maxDim = Math.max(msInfo.shape.x, msInfo.shape.y, msInfo.shape.z || 0)
        raycaster.params.Line.threshold = maxDim * 0.01

        let isDragging = false
        const onPointerDown = () => { isDragging = false }
        const onPointerMove = () => { isDragging = true }
        
        const onPointerUp = (event: PointerEvent) => {
            if (isDragging || !cameraRef.current) return 

            const rect = canvas.getBoundingClientRect()
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            
            raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current)
            const intersects = raycaster.intersectObjects(roiMeshes)
            
            if (intersects.length > 0) {
                const hit = intersects[0]
                const roi = hit.object.userData.roi
                if (roi) {
                    const bbox = getROIBoundingBox(roi)
                    setFrameCenter([bbox.centerX, bbox.centerY])
                    setZSlice(roi.zSlice)
                }
            }
        }

        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', onPointerUp)

        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', onPointerUp)
        }

    }, [rois, roisVisible, msInfo, setFrameCenter, setZSlice, getROIBoundingBox])

    // 4. Resize Handler
    useEffect(() => {
        const handleResize = () => {
            if (rendererRef.current && cameraRef.current) {
                resizeRendererToDisplaySize(rendererRef.current, cameraRef.current)
            }
        }
        window.addEventListener('resize', handleResize)
        handleResize()
        
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    if (!msInfo) return (
        <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500 text-sm">
            Global View (No Data)
        </div>
    )

    return (
        <div className="w-full h-full relative bg-gray-900 overflow-hidden border-t border-gray-700">
             <canvas ref={canvasRef} className="w-full h-full block" />
             <div className="absolute top-2 left-2 text-white/80 text-xs bg-black/50 px-2 py-1 rounded pointer-events-none">
                Global Context
             </div>
        </div>
    )
}