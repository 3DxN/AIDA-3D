// https://react-spectrum.adobe.com/react-aria/useSlider.html#multi-thumb

import { useRef, useEffect } from 'react'

import { useSlider } from '@react-aria/slider'
import { useSliderState } from '@react-stately/slider'
import { useNumberFormatter } from '@react-aria/i18n'

import { Thumb } from './Slider'

const RangeSlider = (props: {
	formatOptions?: object
	label?: string
	onValuesUpdate: (values: number[]) => void
	externalValues?: number[]
	resetToMinMax?: number[]
	minValue?: number
	maxValue?: number
	// Additional props for the slider can be added here
}) => {
	const {
		formatOptions,
		label,
		onValuesUpdate,
		externalValues,
		resetToMinMax,
		// minValue,
		// maxValue,
	} = props
	const trackRef = useRef(null)

	const numberFormatter = useNumberFormatter(formatOptions)
	const state = useSliderState({ ...props, numberFormatter })
	const { groupProps, trackProps, labelProps, outputProps } = useSlider(
		props,
		state,
		trackRef
	)

	// Technically, for the following two useEffect() functions, state should be
	// in the dependency array... the problem is if you do that then the thumbs
	// can't be moved as changes trigger this useEffect() and sort of reset them.
	// Not sure how to handle this effectively.
	useEffect(() => {
		if (externalValues) {
			state.setThumbValue(0, externalValues[0])
			state.setThumbValue(1, externalValues[1])
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [externalValues])

	useEffect(() => {
		if (resetToMinMax) {
			state.setThumbValue(0, resetToMinMax[0])
			state.setThumbValue(1, resetToMinMax[1])
			// state.setThumbPercent(0, 0);
			// state.setThumbPercent(1, 1);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [resetToMinMax])

	useEffect(() => {
		onValuesUpdate(state.values)
	}, [onValuesUpdate, state.values])

	return (
		<div {...groupProps} className="w-full p-2" style={{ touchAction: 'none' }}>
			<div style={{ display: 'flex', alignSelf: 'stretch' }}>
				{label && <label {...labelProps}>{label}</label>}
				{/* <output {...outputProps} style={{ flex: '1 0 auto', textAlign: 'end' }}>
          {`${state.getThumbValueLabel(0)} - ${state.getThumbValueLabel(1)}`}
        </output> */}
			</div>
			<div className="w-full pl-2 flex items-center">
				<div {...trackProps} ref={trackRef} className="relative h-4 flex-1">
					<div
						className="absolute bg-gray-500 top-2 w-full -translate-y-1/2 flex-1"
						style={{ height: 2 }}
					/>
					<Thumb index={0} state={state} trackRef={trackRef} />
					<Thumb index={1} state={state} trackRef={trackRef} />
				</div>
			</div>
		</div>
	)
}

export default RangeSlider
