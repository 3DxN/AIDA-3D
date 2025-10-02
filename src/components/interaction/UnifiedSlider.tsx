'use client'

import { useRef } from 'react'
import { useSliderState } from '@react-stately/slider'
import { useFocusRing } from '@react-aria/focus'
import { VisuallyHidden } from '@react-aria/visually-hidden'
import { mergeProps } from '@react-aria/utils'
import { useNumberFormatter } from '@react-aria/i18n'
import { useSlider, useSliderThumb } from '@react-aria/slider'
import type { NumberFormatOptions } from '@internationalized/number'
import type { AriaSliderProps, SliderProps } from '@react-types/slider'
import type { SliderState } from '@react-stately/slider'

// Unified Slider Component that works for both single value and range sliders
const UnifiedSlider = (props: {
  label?: string
  value: number | number[]
  minValue: number
  maxValue: number
  step?: number
  onChange: (value: number | number[]) => void
  onChangeCommitted?: (value: number | number[]) => void
  formatOptions?: NumberFormatOptions
  isRange?: boolean
  valueDisplay?: string | ((value: number | number[], max: number) => string)
  condition?: boolean
}) => {
  const {
    label,
    value,
    minValue,
    maxValue,
    step = 1,
    onChange,
    onChangeCommitted,
    formatOptions,
    isRange = false,
    valueDisplay,
    condition = true
  } = props

  const trackRef = useRef<HTMLDivElement>(null)
  const numberFormatter = useNumberFormatter(formatOptions || {})

  // Convert single value to array for consistent handling
  const arrayValue = Array.isArray(value) ? value : [value]

  const sliderProps = {
    value: arrayValue,
    onChange: (newValue: number[]) => {
      if (isRange) {
        onChange(newValue)
      } else {
        onChange(newValue[0])
      }
    },
    onChangeEnd: onChangeCommitted ? (newValue: number[]) => {
      if (isRange) {
        onChangeCommitted(newValue)
      } else {
        onChangeCommitted(newValue[0])
      }
    } : undefined,
    minValue,
    maxValue,
    step,
    numberFormatter
  }

  const state = useSliderState(sliderProps)
  const { groupProps, trackProps } = useSlider(sliderProps as AriaSliderProps, state, trackRef)

  if (!condition) return null

  const getDisplayValue = () => {
    if (typeof valueDisplay === 'function') {
      return valueDisplay(value, maxValue)
    }
    if (valueDisplay) {
      return valueDisplay
    }
    if (isRange && Array.isArray(value)) {
      return `${value[0]} - ${value[1]}`
    }
    return `${Array.isArray(value) ? value[0] : value}/${maxValue}`
  }

  return (
    <div {...groupProps} className="w-full p-2" style={{ touchAction: 'none' }}>
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          <div className="text-sm text-gray-600">
            {getDisplayValue()}
          </div>
        </div>
      )}
      
      <div className="w-full pl-2 flex items-center">
        <div {...trackProps} ref={trackRef} className="relative h-4 flex-1">
          <div
            className="absolute bg-gray-500 top-2 w-full -translate-y-1/2"
            style={{ height: 2 }}
          />
          {isRange ? (
            <>
              <Thumb index={0} state={state} trackRef={trackRef} />
              <Thumb index={1} state={state} trackRef={trackRef} />
            </>
          ) : (
            <Thumb index={0} state={state} trackRef={trackRef} />
          )}
        </div>
      </div>
    </div>
  )
}

const Thumb = (props: {
  state: SliderState
  trackRef: React.RefObject<HTMLDivElement | null>
  index: number
}) => {
  const { state, trackRef, index } = props
  const inputRef = useRef(null)
  const { thumbProps, inputProps } = useSliderThumb(
    {
      index,
      trackRef: trackRef as React.RefObject<HTMLElement>,
      inputRef,
    },
    state
  )

  const { focusProps, isFocusVisible } = useFocusRing()
  return (
    <div
      className="absolute top-2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${state.getThumbPercent(index) * 100}%` }}
    >
      <div
        {...thumbProps}
        className="w-4 h-4 rounded-full cursor-pointer"
        style={{
          backgroundColor: isFocusVisible
            ? '#1E40AF' // blue-800
            : state.isThumbDragging(index)
            ? '#374151' // gray-700
            : '#6B7280', // gray-500
        }}
      >
        <VisuallyHidden>
          <input ref={inputRef} {...mergeProps(inputProps, focusProps)} />
        </VisuallyHidden>
      </div>
    </div>
  )
}

export default UnifiedSlider
