// src/components/viewer3D/settings/Labels.tsx

/* eslint-disable max-len */
import { useState, useEffect, useCallback } from 'react'
import { Disclosure } from '@headlessui/react'
import { XIcon } from '@heroicons/react/solid'
import Input from '../../interaction/Input'

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ')
}

const findCommon = (sets) => {
	if (!sets || sets.length === 0) return new Set()
	const result = new Set(sets[0])
	for (let i = 1; i < sets.length; i++) {
		const currentSet = sets[i]
		result.forEach((value) => {
			if (!currentSet || !currentSet.has(value)) {
				result.delete(value)
			}
		})
	}
	return result
}

const Labels = (props: any) => {
	const { featureData, selected, setFeatureData, globalLabels } = props

	const [commonLabels, setCommonLabels] = useState(new Set())
	const [existingLabels, setExistingLabels] = useState(new Set<string>())

	useEffect(() => {
		if (featureData && featureData.labels) {
			const all = new Set<string>()
			featureData.labels.forEach((labelSet: Set<string>) => {
				if (labelSet) {
					labelSet.forEach((label) => all.add(label))
				}
			})
			setExistingLabels(all)
		}
	}, [featureData])

	useEffect(() => {
		if (selected.length === 0) {
			setCommonLabels(new Set())
			return
		}

		if (featureData?.labels) {
			const selectedLabels = selected.map((mesh: THREE.Mesh) => {
				const index = Number(mesh.name.split('_')[1])
				return featureData.labels[index]
			})
			setCommonLabels(findCommon(selectedLabels))
		}
	}, [selected, featureData])

	const commitInput = useCallback(
		(label: string) => {
			if (!globalLabels?.current) return

			setFeatureData((prevData: any) => {
				const newLabels = [...(prevData.labels || [])]
				for (const mesh of selected) {
					const index = Number(mesh.name.split('_')[1])
					const updatedLabels = new Set(newLabels[index] || [])
					updatedLabels.add(label)
					newLabels[index] = updatedLabels
					globalLabels.current.set(index, updatedLabels)
				}
				return { ...prevData, labels: newLabels }
			})
		},
		[selected, setFeatureData, globalLabels]
	)

	const removeLabel = useCallback(
		(label: string) => {
			if (!globalLabels?.current) return

			setFeatureData((prevData: any) => {
				const newLabels = [...(prevData.labels || [])]
				for (const mesh of selected) {
					const index = Number(mesh.name.split('_')[1])
					if (newLabels[index]) {
						const updatedLabels = new Set(newLabels[index])
						updatedLabels.delete(label)
						newLabels[index] = updatedLabels

						if (updatedLabels.size === 0) {
							globalLabels.current.delete(index)
						} else {
							globalLabels.current.set(index, updatedLabels)
						}
					}
				}
				return { ...prevData, labels: newLabels }
			})
		},
		[selected, setFeatureData, globalLabels]
	)

	return (
		<Disclosure className="shadow-sm" as="div">
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
						Labels
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<div>
							<Input
								commitInput={commitInput}
								label={'Add label'}
								disabled={selected.length === 0}
							/>
						</div>

						{selected.length > 0 && (
							<>
								{' '}
								<div className="ml-2 mt-4 mb-1 text-sm">
									Selected item labels:
								</div>
								{Array.from(commonLabels).map((label: any, index) => {
									return (
										<div
											key={index}
											className="flex items-center justify-between mx-2 max-w-48"
										>
											<div className="truncate">{label}</div>
											<button
												type="button"
												className="flex-none inline-flex items-center rounded-full text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500"
												onClick={() => removeLabel(label)}
											>
												<XIcon className="h-3 w-3" aria-hidden="true" />
											</button>
										</div>
									)
								})}
							</>
						)}
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Labels