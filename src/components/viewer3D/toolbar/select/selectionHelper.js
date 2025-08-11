import { Vector2 } from 'three'

// Adapted from
// https://github.com/mrdoob/three.js/blob/dev/examples/jsm/interactive/SelectionHelper.js
// Make conditionally enabled
class SelectionHelper {
	constructor(selectionBox, renderer, cssClassName) {
		this.element = document.createElement('div')
		this.element.classList.add(cssClassName)
		this.element.style.pointerEvents = 'none'

		// Conditionally enabled
		this.enabled = true

		this.renderer = renderer

		this.startPoint = new Vector2()
		this.pointTopLeft = new Vector2()
		this.pointBottomRight = new Vector2()

		this.isDown = false

		this.renderer.domElement.addEventListener(
			'pointerdown',
			function (event) {
				this.isDown = true
				this.onSelectStart(event)
			}.bind(this)
		)

		this.renderer.domElement.addEventListener(
			'pointermove',
			function (event) {
				if (this.isDown) {
					this.onSelectMove(event)
				}
			}.bind(this)
		)

		this.renderer.domElement.addEventListener(
			'pointerup',
			function (event) {
				this.isDown = false
				this.onSelectOver(event)
			}.bind(this)
		)
	}

	onSelectStart(event) {
		if (this.enabled) {
			this.renderer.domElement.parentElement.appendChild(this.element)

			this.element.style.left = event.clientX + 'px'
			this.element.style.top = event.clientY + 'px'
			this.element.style.width = '0px'
			this.element.style.height = '0px'

			this.startPoint.x = event.clientX
			this.startPoint.y = event.clientY
		}
	}

	onSelectMove(event) {
		if (this.enabled) {
			this.pointBottomRight.x = Math.max(this.startPoint.x, event.clientX)
			this.pointBottomRight.y = Math.max(this.startPoint.y, event.clientY)
			this.pointTopLeft.x = Math.min(this.startPoint.x, event.clientX)
			this.pointTopLeft.y = Math.min(this.startPoint.y, event.clientY)

			this.element.style.left = this.pointTopLeft.x + 'px'
			this.element.style.top = this.pointTopLeft.y + 'px'
			this.element.style.width =
				this.pointBottomRight.x - this.pointTopLeft.x + 'px'
			this.element.style.height =
				this.pointBottomRight.y - this.pointTopLeft.y + 'px'
		}
	}

	onSelectOver() {
		if (this.enabled && this.element.parentElement) {
			this.element.parentElement.removeChild(this.element)
		}
	}
}

export { SelectionHelper }