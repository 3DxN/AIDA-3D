// src/components/viewer3D/algorithms/marchingCubes.ts

import * as THREE from 'three';
import { Chunk, Uint32 } from 'zarrita';

// Global variable to hold the initialized WebGPU device
let gpuDevice: GPUDevice | null = null;

async function initializeWebGPU(): Promise<GPUDevice> {
    if (gpuDevice) return gpuDevice;

    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }
    const device = await adapter.requestDevice();
    gpuDevice = device;
    return device;
}

/**
 * Executes the marching cubes algorithm on the GPU for a single binary grid.
 */
async function marchGPU(device: GPUDevice, shaderModule: GPUShaderModule, grid: Uint32Array, dims: number[], isoLevel: number) {
    const [z_size, y_size, x_size] = dims;

    // Uniforms: 4 bytes each for x, y, z sizes, and iso_level (as float bits)
    const uniformData = new Uint32Array(4);
    uniformData[0] = x_size;
    uniformData[1] = y_size;
    uniformData[2] = z_size;
    const isoLevelFloat = new Float32Array([isoLevel]);
    uniformData[3] = new Uint32Array(isoLevelFloat.buffer)[0];

    const gridBuffer = device.createBuffer({
        size: grid.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Uint32Array(gridBuffer.getMappedRange()).set(grid);
    gridBuffer.unmap();

    const maxVertices = (dims[0] * dims[1] * dims[2]) * 5 * 3; // 5 triangles * 3 vertices
    const maxIndices = maxVertices;

    // Counters are 4 bytes each (atomic<u32>)
    const counterSize = 2 * 4;
    const verticesSize = maxVertices * 3 * 4; // 3 floats (x,y,z) per vertex
    const meshOutputBufferSize = counterSize + verticesSize;

    const meshOutputBuffer = device.createBuffer({
        size: meshOutputBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    const indicesOutputBuffer = device.createBuffer({
        size: maxIndices * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    const uniformBuffer = device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const resultBuffer = device.createBuffer({
        size: meshOutputBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const indicesResultBuffer = device.createBuffer({
        size: indicesOutputBuffer.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const computePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: shaderModule,
            entryPoint: 'main',
        },
    });

    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: gridBuffer } },
            { binding: 1, resource: { buffer: meshOutputBuffer } },
            { binding: 2, resource: { buffer: indicesOutputBuffer } },
            { binding: 3, resource: { buffer: uniformBuffer } },
        ],
    });

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(dims[2] / 8), Math.ceil(dims[1] / 8), Math.ceil(dims[0] / 8));
    passEncoder.end();

    commandEncoder.copyBufferToBuffer(meshOutputBuffer, 0, resultBuffer, 0, resultBuffer.size);
    commandEncoder.copyBufferToBuffer(indicesOutputBuffer, 0, indicesResultBuffer, 0, indicesResultBuffer.size);
    device.queue.submit([commandEncoder.finish()]);

    await resultBuffer.mapAsync(GPUMapMode.READ);
    await indicesResultBuffer.mapAsync(GPUMapMode.READ);

    const counters = new Uint32Array(resultBuffer.getMappedRange(0, 8));
    const vertexCount = counters[0];
    const indexCount = counters[1];

    const vertexData = new Float32Array(resultBuffer.getMappedRange(8, vertexCount * 3 * 4));
    const indicesData = new Uint32Array(indicesResultBuffer.getMappedRange(0, indexCount * 4));

    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i < vertexCount; i++) {
        const offset = i * 3;
        vertices.push(new THREE.Vector3(vertexData[offset], vertexData[offset + 1], vertexData[offset + 2]));
    }
    const indices = Array.from(indicesData);

    resultBuffer.unmap();
    indicesResultBuffer.unmap();

    return { vertices, indices };
}


/**
 * Takes a Zarrita chunk and generates meshes using WebGPU.
 */
export async function generateMeshesFromVoxelDataGPU(input: Chunk<Uint32>): Promise<{ label: number; mesh: THREE.Mesh }[]> {
    const device = await initializeWebGPU();

    // Fetch and compile the WGSL shader
    const response = await fetch('/shaders/marchingCubes.wgsl');
    const shaderCode = await response.text();
    const shaderModule = device.createShaderModule({ code: shaderCode });

    const meshArray: { label: number; mesh: THREE.Mesh }[] = [];
    const { data, shape, stride } = input;
    const dims = shape;
    const allVoxelValues = data;
    const uniqueLabels = [...new Set(allVoxelValues)].filter(label => label > 0);

    for (const label of uniqueLabels) {
        const binaryGridData = new Uint32Array(dims[0] * dims[1] * dims[2]);
        let i = 0;
        for (let z = 0; z < dims[0]; z++) {
            for (let y = 0; y < dims[1]; y++) {
                for (let x = 0; x < dims[2]; x++) {
                    binaryGridData[i++] = data[z * stride[0] + y * stride[1] + x * stride[2]] === label ? 1 : 0;
                }
            }
        }

        const { vertices, indices } = await marchGPU(device, shaderModule, binaryGridData, dims, 0.5);

        if (vertices.length > 0 && indices.length > 0) {
            const geometry = new THREE.BufferGeometry();
            geometry.setFromPoints(vertices);
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(label / 10, 0.8, 0.6),
            });
            const mesh = new THREE.Mesh(geometry, material);
            meshArray.push({ label, mesh });
        }
    }

    return meshArray;
}