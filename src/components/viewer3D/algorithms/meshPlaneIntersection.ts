import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';

/**
 * Computes the intersection line segments between a mesh and a plane.
 * Returns an array of line segments (pairs of Vector3 points).
 */
export function computeMeshPlaneIntersection(
    mesh: THREE.Mesh,
    planeZ: number
): THREE.Vector3[][] {
    const geometry = mesh.geometry;
    if (!geometry) return [];

    // Ensure we have position attribute
    const positionAttr = geometry.getAttribute('position');
    if (!positionAttr) return [];

    // Get world matrix to transform vertices
    mesh.updateMatrixWorld();
    const worldMatrix = mesh.matrixWorld;

    const segments: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];

    // Process triangles
    const indices = geometry.index;
    const positions = positionAttr.array;

    const getVertex = (idx: number): THREE.Vector3 => {
        const v = new THREE.Vector3(
            positions[idx * 3],
            positions[idx * 3 + 1],
            positions[idx * 3 + 2]
        );
        v.applyMatrix4(worldMatrix);
        return v;
    };

    const processTriangle = (i0: number, i1: number, i2: number) => {
        const v0 = getVertex(i0);
        const v1 = getVertex(i1);
        const v2 = getVertex(i2);

        // Check which vertices are above/below the plane
        const d0 = v0.z - planeZ;
        const d1 = v1.z - planeZ;
        const d2 = v2.z - planeZ;

        // Find intersection points on edges that cross the plane
        const intersections: THREE.Vector3[] = [];

        // Edge v0-v1
        if ((d0 > 0) !== (d1 > 0)) {
            const t = d0 / (d0 - d1);
            intersections.push(new THREE.Vector3().lerpVectors(v0, v1, t));
        }

        // Edge v1-v2
        if ((d1 > 0) !== (d2 > 0)) {
            const t = d1 / (d1 - d2);
            intersections.push(new THREE.Vector3().lerpVectors(v1, v2, t));
        }

        // Edge v2-v0
        if ((d2 > 0) !== (d0 > 0)) {
            const t = d2 / (d2 - d0);
            intersections.push(new THREE.Vector3().lerpVectors(v2, v0, t));
        }

        // A plane intersects a triangle in exactly 0 or 2 points (ignoring coplanar cases)
        if (intersections.length === 2) {
            segments.push({ start: intersections[0], end: intersections[1] });
        }
    };

    if (indices) {
        // Indexed geometry
        for (let i = 0; i < indices.count; i += 3) {
            processTriangle(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2));
        }
    } else {
        // Non-indexed geometry
        for (let i = 0; i < positionAttr.count; i += 3) {
            processTriangle(i, i + 1, i + 2);
        }
    }

    // Connect segments into continuous lines
    return connectSegments(segments);
}

/**
 * Connects individual line segments into continuous polylines.
 */
function connectSegments(
    segments: Array<{ start: THREE.Vector3; end: THREE.Vector3 }>
): THREE.Vector3[][] {
    if (segments.length === 0) return [];

    const lines: THREE.Vector3[][] = [];
    const used = new Set<number>();
    const epsilon = 0.0001;

    const pointsEqual = (p1: THREE.Vector3, p2: THREE.Vector3): boolean => {
        return p1.distanceTo(p2) < epsilon;
    };

    for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;

        // Start a new line
        const line: THREE.Vector3[] = [segments[i].start, segments[i].end];
        used.add(i);

        // Try to extend the line in both directions
        let extended = true;
        while (extended) {
            extended = false;

            for (let j = 0; j < segments.length; j++) {
                if (used.has(j)) continue;

                const seg = segments[j];
                const lineStart = line[0];
                const lineEnd = line[line.length - 1];

                // Check if segment connects to end of line
                if (pointsEqual(lineEnd, seg.start)) {
                    line.push(seg.end);
                    used.add(j);
                    extended = true;
                } else if (pointsEqual(lineEnd, seg.end)) {
                    line.push(seg.start);
                    used.add(j);
                    extended = true;
                }
                // Check if segment connects to start of line
                else if (pointsEqual(lineStart, seg.end)) {
                    line.unshift(seg.start);
                    used.add(j);
                    extended = true;
                } else if (pointsEqual(lineStart, seg.start)) {
                    line.unshift(seg.end);
                    used.add(j);
                    extended = true;
                }
            }
        }

        lines.push(line);
    }

    return lines;
}

/**
 * Creates Line2 objects (fat lines) from mesh-plane intersection results.
 * Uses cyan color by default to distinguish from the white full-mesh outline.
 * Line2 supports actual line width unlike regular THREE.Line.
 */
export function createIntersectionLines(
    mesh: THREE.Mesh,
    planeZ: number,
    resolution?: THREE.Vector2
): Line2[] {
    // Debug: log mesh bounding box in world coordinates
    mesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(mesh);
    console.log(`[CrossSection] Mesh ${mesh.name}:
  - planeZ: ${planeZ}
  - mesh world Z range: ${box.min.z.toFixed(2)} to ${box.max.z.toFixed(2)}
  - plane intersects mesh: ${planeZ >= box.min.z && planeZ <= box.max.z}`);

    const polylines = computeMeshPlaneIntersection(mesh, planeZ);
    const lines: Line2[] = [];

    console.log(`[CrossSection] Found ${polylines.length} polylines with ${polylines.reduce((sum, p) => sum + p.length, 0)} total points`);

    for (const polyline of polylines) {
        if (polyline.length < 2) continue;

        // Convert Vector3 array to flat array for LineGeometry
        const positions: number[] = [];
        for (const point of polyline) {
            positions.push(point.x, point.y, point.z);
        }

        const geometry = new LineGeometry();
        geometry.setPositions(positions);

        const material = new LineMaterial({
            color: 0x00ffff, // Cyan to distinguish from white OutlinePass
            linewidth: 4, // In pixels
            resolution: resolution || new THREE.Vector2(window.innerWidth, window.innerHeight),
            depthTest: false, // Always visible
        });

        const line = new Line2(geometry, material);
        line.name = `crosssection_outline_${mesh.name}`;
        line.renderOrder = 999; // Render on top
        line.computeLineDistances();
        lines.push(line);
    }

    return lines;
}

/**
 * Helper to dispose Line2 objects properly
 */
export function disposeIntersectionLine(line: Line2): void {
    line.geometry.dispose();
    if (line.material instanceof LineMaterial) {
        line.material.dispose();
    }
}
