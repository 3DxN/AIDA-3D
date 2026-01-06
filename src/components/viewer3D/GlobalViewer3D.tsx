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
        currentZSlice, frameZLayersAbove, frameZLayersBelow 
    } = useViewer2DData()
    const { rois, roisVisible } = useROI()

    useEffect(() => {
        if (!canvasRef.current || !msInfo) return

        const canvas = canvasRef.current
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio)
        
        // Scene setup
        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#111') // Dark grey background

        // Camera setup
        const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000000)
        // Match main viewer orientation (Y down)
        camera.up.set(0, -1, 0)
        
        // Position camera to see the whole store
        const maxX = msInfo.shape.x
        const maxY = msInfo.shape.y
        const maxZ = msInfo.shape.z || 0
        const maxDim = Math.max(maxX, maxY, maxZ)
        
        camera.position.set(maxX / 2, maxY / 2, -maxDim * 1.5) // Look from "front" (negative Z in Three.js terms if reflected? No, wait.)
        // Viewer3D uses .scale.set(1, 1, -1) and camera at negative Z.
        // Here we are in "global" coords which are positive.
        // Let's stick to standard Right-Handed system but with Y down.
        // X right, Y down, Z forward (into screen).
        // If Y is down, Z is away from viewer?
        // Standard Three.js: Y up, Z towards viewer.
        // If we flip Y (up vector 0,-1,0), Y is down. Z is still towards viewer.
        
        camera.position.set(maxX / 2, maxY / 2, maxDim * 2)
        camera.lookAt(maxX / 2, maxY / 2, maxZ / 2)

        // Controls
        const controls = new OrbitControls(camera, canvas)
        controls.target.set(maxX / 2, maxY / 2, maxZ / 2)
        controls.update()

        // 1. Global Wireframe
        // BoxGeometry is centered at origin.
        const globalGeo = new THREE.BoxGeometry(maxX, maxY, maxZ || 1)
        const edges = new THREE.EdgesGeometry(globalGeo)
        const globalWireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x666666 }))
        globalWireframe.position.set(maxX / 2, maxY / 2, maxZ / 2)
        scene.add(globalWireframe)

        // 2. Context Box (Current Selection)
        const width = frameSize[0]
        const height = frameSize[1]
        const depth = frameZLayersAbove + frameZLayersBelow + 1 // +1 for current slice
        const contextGeo = new THREE.BoxGeometry(width, height, depth)
        const contextMat = new THREE.MeshBasicMaterial({ 
            color: 0xaaaaaa, 
            transparent: true, 
            opacity: 0.3, 
            depthWrite: false,
            side: THREE.DoubleSide
        })
        const contextBox = new THREE.Mesh(contextGeo, contextMat)
        
        // Position logic:
        // frameCenter is [x, y]
        // Z center = currentZSlice + (above - below) / 2  <-- Wait.
        // Range is [current - below, current + above]
        // Center = (current - below + current + above) / 2 = (2*current + above - below) / 2 = current + (above - below) / 2
        
        // Wait, if "Layers Below" means "Lower index", then [current - below].
        // Usually Z=0 is top/front.
        
        const zCenter = currentZSlice + (frameZLayersAbove - frameZLayersBelow) / 2
        contextBox.position.set(frameCenter[0], frameCenter[1], zCenter)
        scene.add(contextBox)
        
        // Add Wireframe for Context Box
        const contextEdges = new THREE.EdgesGeometry(contextGeo)
        const contextWireframe = new THREE.LineSegments(contextEdges, new THREE.LineBasicMaterial({ color: 0xffffff }))
        contextWireframe.position.copy(contextBox.position)
        scene.add(contextWireframe)

        // 3. ROIs
        if (roisVisible) {
            rois.forEach(roi => {
                if (roi.vertices.length < 2) return
                
                const points = roi.vertices.map(v => new THREE.Vector3(v.x, v.y, roi.zSlice))
                // Close the loop
                points.push(points[0])
                
                const roiGeo = new THREE.BufferGeometry().setFromPoints(points)
                // Use a distinct color for ROIs
                const roiMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 }) 
                const roiLine = new THREE.Line(roiGeo, roiMat)
                scene.add(roiLine)
            })
        }

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
        }
    }, [msInfo, frameCenter, frameSize, currentZSlice, frameZLayersAbove, frameZLayersBelow, rois, roisVisible])

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
