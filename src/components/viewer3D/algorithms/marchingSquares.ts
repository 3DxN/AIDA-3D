import * as THREE from 'three';

export interface OutlinePoint {
    x: number;
    y: number;
}

export interface OutlineResult {
    points: OutlinePoint[];
    closed: boolean;
}

const squareTable: number[][] = [
    [],              // 0000
    [0, 3],          // 0001
    [1, 0],          // 0010
    [1, 3],          // 0011
    [2, 1],          // 0100
    [0, 3, 2, 1],    // 0101 (ambiguous case)
    [2, 0],          // 0110
    [2, 3],          // 0111
    [3, 2],          // 1000
    [0, 2],          // 1001
    [1, 0, 3, 2],    // 1010 (ambiguous case)
    [1, 2],          // 1011
    [3, 1],          // 1100
    [0, 1],          // 1101
    [3, 0],          // 1110
    []               // 1111
];

const interpolateEdge = (
    x: number,
    y: number,
    edge: number,
    values: number[],
    threshold: number
): OutlinePoint => {
    const edgeVertices = [
        [[0, 0], [1, 0]], // bottom edge
        [[1, 0], [1, 1]], // right edge
        [[1, 1], [0, 1]], // top edge
        [[0, 1], [0, 0]]  // left edge
    ];

    const [v1, v2] = edgeVertices[edge];
    const val1 = values[v1[1] * 2 + v1[0]];
    const val2 = values[v2[1] * 2 + v2[0]];

    let t = 0;
    if (Math.abs(val1 - val2) > 1e-6) {
        t = (threshold - val1) / (val2 - val1);
    }

    const interp = [
        v1[0] + t * (v2[0] - v1[0]),
        v1[1] + t * (v2[1] - v1[1])
    ];

    return {
        x: x + interp[0],
        y: y + interp[1]
    };
};

export const marchingSquares = (
    grid: number[][],
    threshold: number = 0.5
): OutlineResult[] => {
    const height = grid.length;
    const width = grid[0]?.length || 0;

    if (height < 2 || width < 2) {
        return [];
    }

    const segments: Array<{ start: OutlinePoint; end: OutlinePoint }> = [];

    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const values = [
                grid[y][x],         // bottom-left
                grid[y][x + 1],     // bottom-right
                grid[y + 1][x + 1], // top-right
                grid[y + 1][x]      // top-left
            ];

            let squareIndex = 0;
            if (values[0] >= threshold) squareIndex |= 1;
            if (values[1] >= threshold) squareIndex |= 2;
            if (values[2] >= threshold) squareIndex |= 4;
            if (values[3] >= threshold) squareIndex |= 8;

            const edges = squareTable[squareIndex];

            for (let i = 0; i < edges.length; i += 2) {
                if (i + 1 < edges.length) {
                    const start = interpolateEdge(x, y, edges[i], values, threshold);
                    const end = interpolateEdge(x, y, edges[i + 1], values, threshold);
                    segments.push({ start, end });
                }
            }
        }
    }

    return connectSegments(segments);
};

const connectSegments = (
    segments: Array<{ start: OutlinePoint; end: OutlinePoint }>
): OutlineResult[] => {
    if (segments.length === 0) return [];

    const tolerance = 1e-6;
    const used = new Array(segments.length).fill(false);
    const outlines: OutlineResult[] = [];

    const pointsEqual = (p1: OutlinePoint, p2: OutlinePoint): boolean => {
        return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
    };

    for (let i = 0; i < segments.length; i++) {
        if (used[i]) continue;

        const points: OutlinePoint[] = [segments[i].start, segments[i].end];
        used[i] = true;

        let changed = true;
        while (changed) {
            changed = false;

            for (let j = 0; j < segments.length; j++) {
                if (used[j]) continue;

                const firstPoint = points[0];
                const lastPoint = points[points.length - 1];
                const segStart = segments[j].start;
                const segEnd = segments[j].end;

                if (pointsEqual(lastPoint, segStart)) {
                    points.push(segEnd);
                    used[j] = true;
                    changed = true;
                } else if (pointsEqual(lastPoint, segEnd)) {
                    points.push(segStart);
                    used[j] = true;
                    changed = true;
                } else if (pointsEqual(firstPoint, segEnd)) {
                    points.unshift(segStart);
                    used[j] = true;
                    changed = true;
                } else if (pointsEqual(firstPoint, segStart)) {
                    points.unshift(segEnd);
                    used[j] = true;
                    changed = true;
                }
            }
        }

        const closed = pointsEqual(points[0], points[points.length - 1]);
        if (closed && points.length > 1) {
            points.pop();
        }

        outlines.push({ points, closed });
    }

    return outlines;
};

export const projectMeshToScreen = (
    mesh: THREE.Mesh,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer
): { projectedVertices: THREE.Vector2[]; bounds: { min: THREE.Vector2; max: THREE.Vector2 } } => {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const projectedVertices: THREE.Vector2[] = [];

    const worldMatrix = mesh.matrixWorld;
    const tempVector = new THREE.Vector3();
    const tempVector2D = new THREE.Vector2();

    const min = new THREE.Vector2(Infinity, Infinity);
    const max = new THREE.Vector2(-Infinity, -Infinity);

    for (let i = 0; i < positions.count; i++) {
        tempVector.fromBufferAttribute(positions, i);
        tempVector.applyMatrix4(worldMatrix);
        tempVector.project(camera);

        tempVector2D.x = (tempVector.x * 0.5 + 0.5) * renderer.domElement.width;
        tempVector2D.y = (tempVector.y * -0.5 + 0.5) * renderer.domElement.height;

        projectedVertices.push(tempVector2D.clone());

        min.x = Math.min(min.x, tempVector2D.x);
        min.y = Math.min(min.y, tempVector2D.y);
        max.x = Math.max(max.x, tempVector2D.x);
        max.y = Math.max(max.y, tempVector2D.y);
    }

    return { projectedVertices, bounds: { min, max } };
};

export const createOutlineFromProjection = (
    mesh: THREE.Mesh,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    resolution: number = 64
): OutlineResult[] => {
    const { projectedVertices, bounds } = projectMeshToScreen(mesh, camera, renderer);

    if (projectedVertices.length === 0) return [];

    const padding = 5;
    const gridWidth = resolution;
    const gridHeight = resolution;

    const scaleX = (bounds.max.x - bounds.min.x + 2 * padding) / gridWidth;
    const scaleY = (bounds.max.y - bounds.min.y + 2 * padding) / gridHeight;

    const grid = Array.from({ length: gridHeight }, () => new Array(gridWidth).fill(0));

    projectedVertices.forEach(vertex => {
        const gridX = Math.floor((vertex.x - bounds.min.x + padding) / scaleX);
        const gridY = Math.floor((vertex.y - bounds.min.y + padding) / scaleY);

        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            grid[gridY][gridX] = 1;
        }
    });

    for (let y = 1; y < gridHeight - 1; y++) {
        for (let x = 1; x < gridWidth - 1; x++) {
            if (grid[y][x] === 0) {
                let neighborSum = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        neighborSum += grid[y + dy][x + dx];
                    }
                }
                if (neighborSum >= 3) {
                    grid[y][x] = 1;
                }
            }
        }
    }

    const outlines = marchingSquares(grid, 0.5);

    return outlines.map(outline => ({
        points: outline.points.map(point => ({
            x: bounds.min.x - padding + point.x * scaleX,
            y: bounds.min.y - padding + point.y * scaleY
        })),
        closed: outline.closed
    }));
};