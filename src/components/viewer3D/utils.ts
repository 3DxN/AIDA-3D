import { WebGLRenderer, PerspectiveCamera } from 'three'

export const padToTwo = (number: number) => {
	let result
	if (number <= 99) {
		result = `0${number}`.slice(-2)
	}
	return result
}

export const resizeRendererToDisplaySize = (renderer: WebGLRenderer, camera?: PerspectiveCamera) => {
	const canvas = renderer.domElement
	const pixelRatio = window.devicePixelRatio
	const width = (canvas.clientWidth * pixelRatio) | 0
	const height = (canvas.clientHeight * pixelRatio) | 0
	const needResize = canvas.width !== width || canvas.height !== height
	if (needResize) {
		renderer.setSize(width, height, false)
		if (camera) {
			camera.aspect = canvas.clientWidth / canvas.clientHeight
			camera.updateProjectionMatrix()
		}
	}
	return needResize
}
