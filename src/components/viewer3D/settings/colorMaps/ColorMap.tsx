import { XIcon } from '@heroicons/react/solid'

// Manage color maps
const ColorMap = (props: {
	colorMap: any
	index: number
	active: boolean
	setActive: (index: number) => void
	deleteColorMap: (index: number) => void
}) => {
	const { index, colorMap, active, setActive, deleteColorMap } = props

	return (
		<div
			className={`${
				active ? 'text-teal-800 bg-gray-100' : 'text-gray-700 bg-white'
			} flex justify-between w-full text-sm overflow-hidden`}
		>
			<button
				type="button"
				className={`w-24 m-1 truncate text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-500`}
				onClick={() => setActive(index)}
			>
				{colorMap.featureMap?.name || 'None'}
				{colorMap.featureMap?.isTransient && (
					<span className="ml-1 text-xs text-teal-600">(T)</span>
				)}
			</button>

			{/* Visualise current color map */}
			<div
				className="w-16 h-4 m-auto rounded border border-gray-200 border-1"
				style={{
					background: `linear-gradient(to right, ${colorMap.colorScale.value(
						0.1
					)}, ${colorMap.colorScale.value(0.2)}, ${colorMap.colorScale.value(
						0.3
					)}, ${colorMap.colorScale.value(0.4)}, ${colorMap.colorScale.value(
						0.5
					)}, ${colorMap.colorScale.value(0.6)},${colorMap.colorScale.value(
						0.7
					)}, ${colorMap.colorScale.value(0.8)}, ${colorMap.colorScale.value(
						0.9
					)},${colorMap.colorScale.value(1)})`,
				}}
			/>

			{/* Delete color map */}
			<button
				type="button"
				className="inline-flex items-center m-1 text-xs font-medium text-gray-400 hover:text-gray-700  hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
				onClick={() => deleteColorMap(index)}
			>
				<XIcon className="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	)
}

export default ColorMap
