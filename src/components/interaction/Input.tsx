import { useEffect, useRef } from 'react'

export default function Input(props: {
	commitInput: (value: string) => void
	label?: string
	disabled?: boolean
	placeholder?: string
}) {
	const { commitInput, label, disabled, placeholder } = props

	let inputRef = useRef<HTMLInputElement>(null)

	// Add key listener to commit on enter
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !disabled && (e.currentTarget instanceof HTMLTextAreaElement)
				&& e.currentTarget.value.length > 0) {
				console.log('enter')
				e.preventDefault()
				commitInput(e.currentTarget?.value)
				e.currentTarget.value = ''
			}
		}

		const input = inputRef.current
		input?.addEventListener('keydown', handleKeyDown)
		return () => input?.removeEventListener('keydown', handleKeyDown)
	}, [commitInput, disabled])

	return (
		<div>
			{label && (
				<label
					htmlFor="input-text"
					className={`${
						disabled ? 'text-gray-400' : 'text-gray-700'
					} block text-sm font-medium `}
				>
					{label}
				</label>
			)}
			<div className="mt-1">
				<input
					ref={inputRef}
					type="text"
					name="input-text"
					id="input-text"
					className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
					placeholder={placeholder || ''}
					onSubmit={() => console.log('submitted')}
					disabled={disabled}
				/>
			</div>
		</div>
	)
}
