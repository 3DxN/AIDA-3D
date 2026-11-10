
import { useState } from 'react'
import { Disclosure } from '@headlessui/react'
import { Mesh } from 'three'

import EmbeddingModal from './EmbeddingModal'
import type { SceneLayer } from '../layers/sceneLayers'

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ')
}

const SelectedIndices = (props: {
	selected: Mesh[]
	activeLayer?: SceneLayer
	globalProperties: React.MutableRefObject<{ nucleus_index: number;[key: string]: any }[]>
}) => {
	const { selected, activeLayer, globalProperties } = props
	const [embeddingFor, setEmbeddingFor] = useState<number | null>(null)

	// A glyph drawn as several meshes with the same nucleus_<n> name is one selection
	const selectedIndices = [...new Set(selected.map((mesh) => Number(mesh.name.split('_')[1])))]

	// Embeddings are offered for a single selected glyph of a mesh layer
	const single = selectedIndices.length === 1 ? selectedIndices[0] : null
	const isMeshLayer = activeLayer?.kind === 'gltf'
	const embeddings = isMeshLayer ? activeLayer?.embeddings : undefined
	const featureId = embeddingFor === null
		? undefined
		: globalProperties.current.find((entry) => entry.nucleus_index === embeddingFor)?.feature_id

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
						Selected Nuclei
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2">
						{selectedIndices.length > 0 ? (
							<div className="max-h-40 overflow-y-auto">
								<ul className="list-disc pl-5">
									{selectedIndices.map((index) => (
										<li key={index} className="text-sm">
											label-value: {index}
										</li>
									))}
								</ul>
								{single !== null && embeddings && (
									<button
										type="button"
										onClick={() => setEmbeddingFor(single)}
										className="mt-2 text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
									>
										Show embedding
									</button>
								)}
								{single !== null && isMeshLayer && !embeddings && (
									<p className="mt-2 text-xs text-gray-500">No embedding stored for this mesh.</p>
								)}
							</div>
						) : (
							<div className="text-sm text-gray-500">
								No nuclei selected.
							</div>
						)}
					</Disclosure.Panel>
					{embeddingFor !== null && embeddings && (
						<EmbeddingModal
							onClose={() => setEmbeddingFor(null)}
							meshName={activeLayer?.name ?? activeLayer?.sourcePath ?? ''}
							labelValue={embeddingFor}
							featureId={typeof featureId === 'string' ? featureId : undefined}
							embeddings={embeddings}
						/>
					)}
				</>
			)}
		</Disclosure>
	)
}

export default SelectedIndices