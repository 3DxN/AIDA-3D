import { useState, useEffect, useCallback } from 'react'
import { Disclosure } from '@headlessui/react'
import { Camera, Scene, WebGLRenderer, Group, DirectionalLight, AmbientLight, MeshStandardMaterial } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ')
}

const Appearance = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
	composer?: EffectComposer
}) => {
	const { content, scene, camera, composer } = props

	const [brightness, setBrightness] = useState(50)
	const [transparency, setTransparency] = useState(0)

	// Update lighting based on brightness slider
	const updateLighting = useCallback((value: number) => {
		if (!camera || !scene) return

		// Scale brightness from 0-100 to intensity values
		const ambientIntensity = (value / 100) * 2.0  // 0 to 2.0
		const directionalIntensity = (value / 100) * 3.0  // 0 to 3.0

		// Find and update lights
		camera.traverse((child) => {
			if (child instanceof DirectionalLight) {
				child.intensity = directionalIntensity
			}
		})

		scene.traverse((child) => {
			if (child instanceof AmbientLight) {
				child.intensity = ambientIntensity
			}
		})

		if (composer) composer.render()
	}, [camera, scene, composer])

	// Update material transparency
	const updateTransparency = useCallback((value: number) => {
		if (!content) return

		const opacity = 1 - (value / 100)  // 0% transparency = 1.0 opacity, 100% = 0.0

		content.traverse((child) => {
			if ((child as any).isMesh) {
				const material = (child as any).material as MeshStandardMaterial
				if (material) {
					material.transparent = value > 0
					material.opacity = opacity
					material.needsUpdate = true
				}
			}
		})

		if (composer) composer.render()
	}, [content, composer])

	// Apply initial values when component mounts
	useEffect(() => {
		updateLighting(brightness)
	}, [scene, camera, updateLighting, brightness])

	useEffect(() => {
		updateTransparency(transparency)
	}, [content, updateTransparency, transparency])

	const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseInt(e.target.value, 10)
		setBrightness(value)
		updateLighting(value)
	}

	const handleTransparencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseInt(e.target.value, 10)
		setTransparency(value)
		updateTransparency(value)
	}

	return (
		<Disclosure className="shadow-sm" as="div" defaultOpen>
			{({ open }) => (
				<>
					<Disclosure.Button
						className={classNames(
							'text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
						)}
					>
						<svg
							className={classNames(
								open ? 'text-gray-400 rotate-90' : 'text-gray-300',
								'mr-2 shrink-0 h-5 w-5 group-hover:text-gray-400 transition-colors ease-in-out duration-150'
							)}
							viewBox="0 0 20 20"
							aria-hidden="true"
						>
							<path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
						</svg>
						Appearance
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 space-y-3">
						<div>
							<div className="flex justify-between text-sm text-gray-600 mb-1">
								<label>Brightness</label>
								<span>{brightness}%</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								value={brightness}
								onChange={handleBrightnessChange}
								className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
							/>
						</div>
						<div>
							<div className="flex justify-between text-sm text-gray-600 mb-1">
								<label>Transparency</label>
								<span>{transparency}%</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								value={transparency}
								onChange={handleTransparencyChange}
								className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
							/>
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Appearance
