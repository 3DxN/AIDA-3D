// src/gltfExporter.ts

import * as THREE from 'three'
// Corrected import path
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'

const saveString = (text: string, filename: string) => {
	const link = document.createElement('a')
	link.style.display = 'none'
	document.body.appendChild(link)
	const blob = new Blob([text], { type: 'text/plain' })
	link.href = URL.createObjectURL(blob)
	link.download = filename
	link.click()
	document.body.removeChild(link)
}

/**
 * Exports a Three.js scene or object to a GLTF file and triggers a download.
 * @param input - The THREE.Scene or THREE.Object3D to export.
 * @param filename - The name of the file to save.
 */
export const saveGLTF = (input: THREE.Object3D, filename: string) => {
	const gltfExporter = new GLTFExporter()
	gltfExporter.parse(
		input,
		(result) => {
			if (result instanceof ArrayBuffer) {
				saveString(new TextDecoder().decode(result), filename)
			} else {
				const output = JSON.stringify(result, null, 2)
				saveString(output, filename)
			}
		},
		(error) => {
			console.error('An error happened during GLTF exportation:', error)
		},
		{
			binary: false,
		}
	)
}