import { useState, useEffect, useRef } from 'react'
import {
	Camera,
	Scene,
	WebGLRenderer,
	Group,
	Vector2,
	Vector3,
	Box3,
	Raycaster,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const Tools = (props: {
	content: Group
	renderer: WebGLRenderer
	scene: Scene
	camera: Camera
	setSelect3D: (select3D: boolean) => void
}) => {
	const { renderer, scene, camera, content, setSelect3D, setSelected } = props

	const [orbitControls, setOrbitControls] = useState(null)
	const selectActive = useRef(true)

	// Initialise orbit controls
	useEffect(() => {
		function render() {

			renderer.render(scene, camera)
		}

		if (renderer && scene && camera) {
			const newControls = new OrbitControls(camera, renderer.domElement)
			newControls.addEventListener('change', () => render()) // use if there is no animation loop
			newControls.minDistance = 2
			newControls.maxDistance = 10
			newControls.target.set(0, 0, -0.2)
			newControls.update()

            setOrbitControls(newControls)
            const canvas = renderer.domElement;

            const preventPageZoom = (event: WheelEvent) => {
                // Stop the browser from performing its default action (zooming the page).
                event.preventDefault();
            };

            // The { passive: false } is important to allow preventDefault to work.
            canvas.addEventListener('wheel', preventPageZoom, { passive: false });

            // Cleanup function to remove the event listener when the component unmounts.
            return () => {
                canvas.removeEventListener('wheel', preventPageZoom);
            };
		}
	}, [renderer, scene, camera])

	// Update controls to orbit around the center of the object
	useEffect(() => {
		if (content && orbitControls) {
			const box = new Box3().setFromObject(content)
			const size = box.getSize(new Vector3()).length()
			const center = box.getCenter(new Vector3())

			orbitControls.target = center
			orbitControls.maxDistance = size * 10
			orbitControls.saveState()
		}
	}, [content, orbitControls])

	// Selection, modified version of the following example:
	// https://threejs.org/examples/?q=select#misc_boxselection
	// Key addition is select first mesh intersected with ray onClick.
    useEffect(() => {
        // Exit if the required objects aren't ready
        if (!camera || !scene || !renderer || !orbitControls) return;

        function findFirstIntersection(raycaster, pointer) {
            if (scene && scene.children[0]) {
                raycaster.setFromCamera(pointer, camera);
                const intersects = raycaster.intersectObject(scene.children[0], true);

                if (intersects.length > 0) {
                    const firstMesh = intersects.find((o) => {
                        if (o.object.geometry.boundingSphere === null)
                            o.object.geometry.computeBoundingSphere();
                        const sphere = o.object.geometry.boundingSphere.clone();
                        o.object.localToWorld(sphere.center);
                        const center = sphere.center;

                        return (
                            o.object.type === 'Mesh' &&
                            o.object.visible &&
                            renderer.clippingPlanes.every((plane) => {
                                const dot = center.dot(plane.normal) + plane.constant < 0;
                                const intersects = sphere.intersectsPlane(plane);
                                return !dot || intersects;
                            })
                        );
                    });
                    return firstMesh;
                }
            }
        }

        const canvas = renderer.domElement;
        const raycaster = new Raycaster();
        let isDragging = false;
        const mouseDownPoint = new Vector2();

        const onPointerDown = (event) => {
            isDragging = false;
            mouseDownPoint.set(event.clientX, event.clientY);
        };

        const onPointerMove = (event) => {
            const distance = mouseDownPoint.distanceTo(new Vector2(event.clientX, event.clientY));
            if (distance > 5) { // Drag threshold in pixels
                isDragging = true;
            }
        };

        const onPointerUp = (event) => {
            // If it was a drag, do nothing and let OrbitControls handle it.
            if (isDragging) {
                return;
            }

            // --- It was a click, so handle selection logic ---
            const rect = canvas.getBoundingClientRect();
            const pointer = new Vector2();
            pointer.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

            const firstIntersection = findFirstIntersection(raycaster, pointer);
            const clickedObject = firstIntersection ? firstIntersection.object : null;

            // Indicate to the 2D viewer that a selection event occurred
            setSelect3D(value => !value);

            setSelected(prevSelected => {
                // First, get the last selected item for Ctrl+click logic.
                const lastSelected = prevSelected.length > 0 ? prevSelected[prevSelected.length - 1] : null;

                // Turn off all previous highlights.
                prevSelected.forEach(item => {
                    if (item.material.emissive) {
                        item.material.emissive.set(0x000000);
                    }
                });

                let newSelection = [];

                // Determine the new selection array based on modifier keys.
                if (event.ctrlKey && clickedObject && lastSelected && lastSelected !== clickedObject) {
                    // Select only the last-selected and the current-clicked nucleus.
                    newSelection = [lastSelected, clickedObject];
                } else if (event.shiftKey && clickedObject) {
                    // Add or remove the clicked nucleus from the selection (toggle).
                    const currentSelectionSet = new Set(prevSelected);
                    if (currentSelectionSet.has(clickedObject)) {
                        currentSelectionSet.delete(clickedObject);
                    } else {
                        currentSelectionSet.add(clickedObject);
                    }
                    newSelection = Array.from(currentSelectionSet);
                } else if (clickedObject) {
                    // Default click: select only the clicked nucleus.
                    newSelection = [clickedObject];
                }
                // If nothing was clicked, newSelection remains [], clearing the selection.

                // Turn on highlights for all items in the new selection.
                newSelection.forEach(item => {
                    if (item.material.emissive) {
                        item.material.emissive.set(0xffffff);
                    }
                });

                return newSelection;
            });
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);

        // Cleanup function on component unmount
        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
        };
    }, [camera, scene, renderer, orbitControls, setSelected, setSelect3D]);
	return null};
export default Tools;