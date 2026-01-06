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

    useEffect(() => {
        if (!canvasRef.current || !msInfo) return

        const canvas = canvasRef.current
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio)
        
        // Scene setup
        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#111') // Dark grey background

        // Content Group to match Local Viewer's coordinate system (Reflect Z)
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
        camera.up.set(0, -1, 0) // Match main viewer orientation (Y down)
        
        // Position camera at Negative Z (looking from "front" in this inverted system)
        // Center of data is at (centerX, centerY, -centerZ) in World Space due to group scale
        camera.position.set(centerX, centerY, -maxDim * 2)
        camera.lookAt(centerX, centerY, -centerZ)

        // Controls
        const controls = new OrbitControls(camera, canvas)
        controls.target.set(centerX, centerY, -centerZ)
        controls.update()

        // 1. Global Wireframe
        const globalGeo = new THREE.BoxGeometry(maxX, maxY, maxZ || 1)
        const edges = new THREE.EdgesGeometry(globalGeo)
        const globalWireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x666666 }))
        globalWireframe.position.set(centerX, centerY, centerZ)
        contentGroup.add(globalWireframe)

        // 2. Context Box (Current Selection)
        const width = frameSize[0]
        const height = frameSize[1]
        const depth = frameZLayersAbove + frameZLayersBelow + 1
        const contextGeo = new THREE.BoxGeometry(width, height, depth)
        const contextMat = new THREE.MeshBasicMaterial({ 
            color: 0xaaaaaa, 
            transparent: true, 
            opacity: 0.3, 
            depthWrite: false,
            side: THREE.DoubleSide
        })
        const contextBox = new THREE.Mesh(contextGeo, contextMat)
        
        const zCenter = currentZSlice + (frameZLayersAbove - frameZLayersBelow) / 2
        contextBox.position.set(frameCenter[0], frameCenter[1], zCenter)
        contentGroup.add(contextBox)
        
        // Add Wireframe for Context Box
        const contextEdges = new THREE.EdgesGeometry(contextGeo)
        const contextWireframe = new THREE.LineSegments(contextEdges, new THREE.LineBasicMaterial({ color: 0xffffff }))
        contextWireframe.position.copy(contextBox.position)
        contentGroup.add(contextWireframe)

        // 3. ROIs & Interaction
        const roiMeshes: THREE.Line[] = []
        if (roisVisible) {
            rois.forEach(roi => {
                if (roi.vertices.length < 2) return
                
                const points = roi.vertices.map(v => new THREE.Vector3(v.x, v.y, roi.zSlice))
                points.push(points[0]) // Close loop
                
                const roiGeo = new THREE.BufferGeometry().setFromPoints(points)
                const roiMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 }) 
                const roiLine = new THREE.Line(roiGeo, roiMat)
                
                roiLine.userData = { roi }
                
                contentGroup.add(roiLine)
                roiMeshes.push(roiLine)
            })
        }

        // Raycaster for interaction
        const raycaster = new THREE.Raycaster()
        raycaster.params.Line.threshold = maxDim * 0.01 // Make it easier to click lines (1% of max dimension)
        
        // Handle click
        let isDragging = false
        const onPointerDown = () => { isDragging = false }
        const onPointerMove = () => { isDragging = true }
        
        const onPointerUp = (event: PointerEvent) => {
            if (isDragging) return // Ignore drags (orbiting)

            const rect = canvas.getBoundingClientRect()
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            
            raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
            const intersects = raycaster.intersectObjects(roiMeshes)
            
            if (intersects.length > 0) {
                const hit = intersects[0]
                const roi = hit.object.userData.roi
                if (roi) {
                    console.log('🎯 Clicked ROI:', roi.label)
                    const bbox = getROIBoundingBox(roi)
                    setFrameCenter([bbox.centerX, bbox.centerY])
                    setZSlice(roi.zSlice)
                }
            }
        }

        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', onPointerUp)

        // Render Loop
        let animationId: number
        const animate = () => {
            animationId = requestAnimationFrame(animate)
            controls.update()
            renderer.render(scene, camera)
        }
        animate()
        
        // Resize handler
        const handleResize = () => {
            resizeRendererToDisplaySize(renderer, camera)
        }
        window.addEventListener('resize', handleResize)
        handleResize() // Init size

        return () => {
            window.removeEventListener('resize', handleResize)
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', onPointerUp)
            cancelAnimationFrame(animationId)
            renderer.dispose()
            controls.dispose()
            // Cleanup geometries/materials
            globalGeo.dispose()
            edges.dispose()
            globalWireframe.material.dispose()
            contextGeo.dispose()
            contextMat.dispose()
            contextEdges.dispose()
            contextWireframe.material.dispose()
            roiMeshes.forEach(mesh => {
                if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
                    mesh.geometry.dispose()
                }
                if (mesh.material) {
                    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    materials.forEach(m => m.dispose && m.dispose());
                }
            })
        }
    }, [msInfo, frameCenter, frameSize, currentZSlice, frameZLayersAbove, frameZLayersBelow, rois, roisVisible, setFrameCenter, setZSlice, getROIBoundingBox])

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
