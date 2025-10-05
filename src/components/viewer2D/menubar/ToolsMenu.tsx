import { useState, useEffect, useRef } from 'react'
import Map from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Geometry from 'ol/geom/Geometry'
import Draw, { DrawEvent } from 'ol/interaction/Draw'
import DragPan from 'ol/interaction/DragPan'
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom'
import PinchZoom from 'ol/interaction/PinchZoom'
import PinchRotate from 'ol/interaction/PinchRotate'
import DragRotate from 'ol/interaction/DragRotate'
import Select from 'ol/interaction/Select'
import DragBox from 'ol/interaction/DragBox'
import Translate from 'ol/interaction/Translate'
import Modify from 'ol/interaction/Modify'
import { createBox } from 'ol/interaction/Draw'
import * as olExtent from 'ol/extent'
import Feature from 'ol/Feature'
import { Style, Fill, Stroke } from 'ol/style'
import Polygon from 'ol/geom/Polygon'
import { Extent } from 'ol/extent'
import Link from 'next/link'
import { MenuIcon } from '@heroicons/react/outline'
import { save } from '../../../api/save'
import { DropdownMenu } from '../../interaction/DropdownMenu'

interface ToolsMenuProps {
  map: Map
  setTile: (tile: [number, number]) => void
  setPolygonCoords: (coords: any) => void
  select3D: boolean
}

export default function ToolsMenu({ map, setTile, setPolygonCoords, select3D }: ToolsMenuProps) {
  const tools = ['pan', 'polygon']
  const selectedFeature = useRef<Feature<Polygon>>()
  const activePolygon = useRef<Feature<Polygon> | null>()

  const vectorLayer = map.getLayers().get('activeLayer').layer as VectorLayer<VectorSource<Geometry>>
  const [activeTool, setActiveTool] = useState('pan')
  const [vectorSource, setVectorSource] = useState(vectorLayer.getSource())
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  // Listen to changes to the active property on the layers collection
  useEffect(() => {
    const layers = map.getLayers()
    const listener = () => {
      const activeLayer = layers.get('activeLayer').layer
      if (activeLayer) setVectorSource(activeLayer.getSource())
    }

    layers.on('propertychange', listener)
    return () => {
      layers.un('propertychange', listener)
    }
  }, [map])

  let clipboardFeatures: Feature<Geometry>[] = []
  let mousePos = [0, 0]
  map.on('pointermove', (event) => {
    mousePos = event.coordinate
  })

  useEffect(() => {
    const listener = () => setUnsavedChanges(map.get('unsavedChanges'))
    map.on('propertychange', listener)
    return () => map.un('propertychange', listener)
  }, [map])

  // Initialise tools
  useEffect(() => {
    const setClass = (e: DrawEvent) => {
      const featureClass = map.get('featureClasses')[map.get('activeFeatureClass')]
      e.feature.set('class', featureClass.id)

      e.feature.setStyle(
        new Style({
          stroke: new Stroke({
            color: featureClass.style.stroke.color,
            width: featureClass.style.stroke.width,
          }),
        })
      )

      if (featureClass.style.fill) {
        e.feature.setStyle(
          new Style({
            fill: new Fill({
              color: featureClass.style.fill.color,
            }),
            stroke: new Stroke({
              color: featureClass.style.stroke.color,
              width: featureClass.style.stroke.width,
            }),
          })
        )
      }
    }

    map.getInteractions().clear()

    const conditionalDragPan = new DragPan({
      condition: (e) => e.originalEvent.button === 1,
    })
    conditionalDragPan.set('id', 'conditionalDragPan')

    const mouseWheelZoom = new MouseWheelZoom()
    mouseWheelZoom.setActive(true)
    mouseWheelZoom.set('id', 'mouseWheelZoom')

    const pinchZoom = new PinchZoom()
    pinchZoom.setActive(true)
    pinchZoom.set('id', 'pinchZoom')

    const pinchRotate = new PinchRotate()
    pinchRotate.setActive(true)
    pinchRotate.set('id', 'pinchRotate')

    const pan = new DragPan()
    pan.set('id', 'pan')

    const rotate = new DragRotate()
    rotate.set('id', 'rotate')

    const select = new Select()
    select.setActive(false)
    select.set('id', 'select')

    const dragBox = new DragBox({
      className: 'border border-blue-500 bg-gray-50 bg-opacity-25',
    })
    dragBox.on('boxend', () => {
      const extent = dragBox.getGeometry().getExtent()
      const features = vectorSource.getFeaturesInExtent(extent)
      select.getFeatures().clear()
      select.getFeatures().extend(features)
    })
    dragBox.setActive(false)
    dragBox.set('id', 'dragBox')

    const translate = new Translate({ features: select.getFeatures() })
    translate.setActive(false)
    translate.set('id', 'translate')

    const modify = new Modify({ features: select.getFeatures() })
    modify.setActive(false)
    modify.set('id', 'modify')

    const box = new Draw({
      source: vectorSource,
      type: 'Circle',
      geometryFunction: createBox(),
    })
    box.setActive(false)
    box.set('id', 'box')
    box.on('drawend', setClass)

    const point = new Draw({
      source: vectorSource,
      type: 'Point',
    })
    point.setActive(false)
    point.set('id', 'point')

    const lineString = new Draw({
      source: vectorSource,
      type: 'LineString',
    })
    lineString.setActive(false)
    lineString.set('id', 'lineString')

    const polygon = new Draw({
      source: vectorSource,
      type: 'Polygon',
    })
    polygon.setActive(false)
    polygon.set('id', 'polygon')
    polygon.on('drawstart', () => {
      if (activePolygon.current)
        vectorSource.removeFeature(activePolygon.current)
      setPolygonCoords(null)
    })

    polygon.on('drawabort', () => (activePolygon.current = null))

    polygon.on('drawend', (e) => {
      if (selectedFeature.current) {
        activePolygon.current = e.feature;
        const coords = e.feature.getGeometry().getCoordinates();

        const featureExtent = selectedFeature.current.getGeometry()?.getExtent();
        const polygonCoords = coords[0].map((coord) => [
          coord[0] - featureExtent[0],
          coord[1] - featureExtent[1],
        ]);

        const shouldAccumulate = e.originalEvent.shiftKey || e.originalEvent.ctrlKey;

        setPolygonCoords({ coords: polygonCoords, accumulate: shouldAccumulate });
      }
    });
    polygon.on('drawend', setClass)

    map
      .getInteractions()
      .extend([
        conditionalDragPan,
        mouseWheelZoom,
        pinchZoom,
        pinchRotate,
        pan,
        rotate,
        select,
        dragBox,
        translate,
        modify,
        box,
        point,
        lineString,
        polygon,
      ])
  }, [map, vectorSource, setPolygonCoords])

  useEffect(() => {
    if (activePolygon.current) vectorSource.removeFeature(activePolygon.current)
    activePolygon.current = null
    setPolygonCoords(null)
  }, [select3D, vectorSource, setPolygonCoords])

  useEffect(() => {
    const activeInteractions = [
      'mouseWheelZoom',
      'conditionalDragPan',
      'pinchZoom',
    ]

    switch (activeTool) {
      case 'pan':
        activeInteractions.push('pan', 'rotate')
        break
      case 'select':
        activeInteractions.push('select', 'translate', 'dragBox')
        break
      case 'modify':
        activeInteractions.push('modify', 'select', 'dragBox')
        break
      case 'point':
        activeInteractions.push('point')
        break
      case 'lineString':
        activeInteractions.push('lineString')
        break
      case 'polygon':
        activeInteractions.push('polygon')
        break
      case 'box':
        activeInteractions.push('box')
        break
      default:
        activeInteractions.push('pan')
        break
    }

    const interactions = map.getInteractions().getArray()
    interactions.forEach((interaction) => {
      if (activeInteractions.includes(interaction.get('id'))) {
        interaction.setActive(true)
      } else {
        interaction.setActive(false)
      }
    })
  }, [activeTool, map, vectorSource])

  useEffect(() => {
    const handleClick = (e) => {
      if (activeTool === 'pan') {
        const features = map.getFeaturesAtPixel(e.pixel)
        const gridFeature = features.find((feature) =>
          feature.get('id').startsWith('grid')
        )

        if (gridFeature) {
          const col = gridFeature.get('3D-col')
          const row = gridFeature.get('3D-row')
          setTile([col, row])

          selectedFeature.current?.setStyle(
            new Style({
              fill: new Fill({
                color: 'rgba(255, 255, 255, 0)',
              }),
              stroke: new Stroke({
                color: '#3399CC',
                width: 1,
              }),
            })
          )

          selectedFeature.current = gridFeature as Feature<Polygon>
          selectedFeature.current.setStyle(
            new Style({
              fill: new Fill({
                color: 'rgba(255, 255, 255, 0)',
              }),
              stroke: new Stroke({
                color: '#0d9488',
                width: 4,
              }),
            })
          )

          map.getView().fit(gridFeature.getGeometry()?.getExtent() as Extent)
        }
      }
    }

    if (map) map.on('click', handleClick)
    return () => map.un('click', handleClick)
  }, [map, setTile, activeTool])

  return (
    <>
      <Link href="/local" legacyBehavior>
        <a className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center gap-1">
          <MenuIcon className="h-4 w-4" aria-hidden="true" />
          Menu
        </a>
      </Link>

      <button
        className={`${
          unsavedChanges
            ? 'text-gray-700 hover:bg-gray-100'
            : 'text-gray-300 opacity-60'
        } px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500`}
        onClick={() => save(map)}
        disabled={!unsavedChanges}
        title="Save"
        type="button"
      >
        Save
      </button>

      <DropdownMenu label="Tools">
        <div className="p-1">
          {tools?.includes('pan') && (
            <button
              className={`${
                activeTool === 'pan'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-700'
              } w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2`}
              onClick={() => setActiveTool('pan')}
              title="Pan"
              type="button"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9 3a1 1 0 012 0v5.5a.5.5 0 001 0V4a1 1 0 112 0v4.5a.5.5 0 001 0V6a1 1 0 112 0v5a7 7 0 11-14 0V9a1 1 0 012 0v2.5a.5.5 0 001 0V4a1 1 0 012 0v4.5a.5.5 0 001 0V3z" clipRule="evenodd" />
              </svg>
              Pan
            </button>
          )}

          {tools?.includes('polygon') && (
            <button
              className={`${
                activeTool === 'polygon'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-700'
              } w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2`}
              onClick={() => setActiveTool('polygon')}
              title="Polygon"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17,15.7V13H19V17L10,21L3,14L7,5H11V7H8.3L5.4,13.6L10.4,18.6L17,15.7M22,5V7H19V10H17V7H14V5H17V2H19V5H22Z" />
              </svg>
              Polygon
            </button>
          )}
        </div>
      </DropdownMenu>
    </>
  )
}
