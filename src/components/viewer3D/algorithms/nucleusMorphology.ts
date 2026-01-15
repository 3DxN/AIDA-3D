import * as THREE from 'three';

interface MorphologyResult {
    elongation: number;
    flatness: number;
    sphericity: number;
    axes: [number, number, number];
    orientationMatrix: number[][]; // 3x3 matrix as array of rows
}

// Eigenvalue decomposition for 3x3 symmetric matrix
// Based on numerical recipes or similar standard implementations
function computeEigenDecomposition(matrix: number[][]): { values: number[], vectors: number[][] } {
    // This is a simplified solver or we can use a library if available. 
    // Since we don't want to add deps, we can use a robust iterative method like Jacobi or a closed form for 3x3.
    // For 3x3, a closed form exists but can be numerically unstable. Jacobi is better.
    
    // However, implementing a full Jacobi solver here might be verbose. 
    // Let's assume we can get by with a simple estimation or check if 'mathjs' or similar is used.
    // Checking package.json would be wise, but for now I'll implement a basic Jacobi algorithm.

    const n = 3;
    let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // Eigenvectors
    let D = [
        [matrix[0][0], matrix[0][1], matrix[0][2]],
        [matrix[1][0], matrix[1][1], matrix[1][2]],
        [matrix[2][0], matrix[2][1], matrix[2][2]]
    ];

    const maxIter = 50;
    for (let iter = 0; iter < maxIter; iter++) {
        let maxOffDiag = 0;
        let p = 0, q = 0;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(D[i][j]) > maxOffDiag) {
                    maxOffDiag = Math.abs(D[i][j]);
                    p = i;
                    q = j;
                }
            }
        }

        if (maxOffDiag < 1e-9) break;

        const phi = 0.5 * Math.atan2(2 * D[p][q], D[p][p] - D[q][q]);
        const c = Math.cos(phi);
        const s = Math.sin(phi);

        // Rotate D
        // D_new = J^T * D * J
        // We only need to update relevant elements
        const D_pp = D[p][p];
        const D_qq = D[q][q];
        const D_pq = D[p][q];

        D[p][p] = c * c * D_pp - 2 * c * s * D_pq + s * s * D_qq;
        D[q][q] = s * s * D_pp + 2 * c * s * D_pq + c * c * D_qq;
        D[p][q] = 0; // By definition
        D[q][p] = 0;

        for (let i = 0; i < n; i++) {
            if (i !== p && i !== q) {
                const D_ip = D[i][p];
                const D_iq = D[i][q];
                D[i][p] = c * D_ip - s * D_iq;
                D[p][i] = D[i][p];
                D[i][q] = s * D_ip + c * D_iq;
                D[q][i] = D[i][q];
            }
        }

        // Update V (Eigenvectors)
        // V_new = V * J
        for (let i = 0; i < n; i++) {
            const V_ip = V[i][p];
            const V_iq = V[i][q];
            V[i][p] = c * V_ip - s * V_iq;
            V[i][q] = s * V_ip + c * V_iq;
        }
    }

    const eigenvalues = [D[0][0], D[1][1], D[2][2]];
    
    // Sort eigenvalues and corresponding vectors (descending)
    const indices = [0, 1, 2].sort((a, b) => eigenvalues[b] - eigenvalues[a]);
    
    const sortedValues = indices.map(i => eigenvalues[i]);
    const sortedVectors = [
        [V[0][indices[0]], V[1][indices[0]], V[2][indices[0]]],
        [V[0][indices[1]], V[1][indices[1]], V[2][indices[1]]],
        [V[0][indices[2]], V[1][indices[2]], V[2][indices[2]]]
    ];

    return { values: sortedValues, vectors: sortedVectors };
}

export function calculateNucleusMorphology(mesh: THREE.Mesh): MorphologyResult {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const positionAttribute = geometry.getAttribute('position');
    const vertexCount = positionAttribute.count;

    // 1. Calculate Center of Mass (Centroid)
    const center = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
        center.x += positionAttribute.getX(i);
        center.y += positionAttribute.getY(i);
        center.z += positionAttribute.getZ(i);
    }
    center.divideScalar(vertexCount);

    // 2. Compute Covariance Matrix
    // C_xx = sum((x_i - cx)^2) / N, C_xy = sum((x_i - cx)(y_i - cy)) / N, etc.
    let C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    
    for (let i = 0; i < vertexCount; i++) {
        const x = positionAttribute.getX(i) - center.x;
        const y = positionAttribute.getY(i) - center.y;
        const z = positionAttribute.getZ(i) - center.z;

        C[0][0] += x * x;
        C[0][1] += x * y;
        C[0][2] += x * z;
        C[1][1] += y * y;
        C[1][2] += y * z;
        C[2][2] += z * z;
    }
    
    // Fill symmetric parts
    C[0][0] /= vertexCount; C[0][1] /= vertexCount; C[0][2] /= vertexCount;
    C[1][1] /= vertexCount; C[1][2] /= vertexCount;
    C[2][2] /= vertexCount;
    C[1][0] = C[0][1];
    C[2][0] = C[0][2];
    C[2][1] = C[1][2];

    // 3. Eigen Decomposition
    const { values, vectors } = computeEigenDecomposition(C);

    // 4. Calculate Axes lengths
    // Eigenvalues represent variance along the principal axes.
    // StdDev = sqrt(eigenvalue)
    // For a uniform ellipsoid, semi-axis length ~ sqrt(3) * StdDev ? 
    // Or just use sqrt(eigenvalue) as the representative "radius" (scale factor).
    // Let's use sqrt(values) directly for ratio calculations.
    
    const radii = values.map(v => Math.sqrt(Math.max(0, v)));
    const [a, b, c] = radii; // major, intermediate, minor

    // Avoid division by zero
    const elongation = b > 0 ? a / b : 1;
    const flatness = c > 0 ? b / c : 1;
    const sphericity = a > 0 ? c / a : 1;

    return {
        elongation: isFinite(elongation) ? elongation : 1,
        flatness: isFinite(flatness) ? flatness : 1,
        sphericity: isFinite(sphericity) ? sphericity : 1,
        axes: [a, b, c],
        orientationMatrix: vectors
    };
}
