import { ZarrPixelSource } from '@hms-dbmi/viv';
import type { DataType } from 'zarrita';
import * as zarr from 'zarrita';

// Mock array that returns static noise
class MockZarrArray {
    dtype: DataType = 'uint8';
    shape: number[] = [1, 512, 512]; // Z, Y, X
    chunks: number[] = [1, 256, 256];

    async get_chunk(coords: number[]) {
        const size = 256 * 256;
        const data = new Uint8Array(size);
        for(let i=0; i<size; i++) data[i] = Math.random() * 255; // Random noise
        return { data, shape: [1, 256, 256], stride: [65536, 256, 1] };
    }
}

export default class MockPixelSource extends ZarrPixelSource {
    constructor() {
        // ZarrPixelSource(data, labels, tileSize) - labels is 2nd arg
        super(new MockZarrArray() as any, ['t', 'c', 'z', 'y', 'x'], 256);
    }

    async getRaster({ selection }: any) {
        const size = 256 * 256;
        const data = new Uint8Array(size);
        // Generate a diagonal gradient pattern
        for(let i=0; i<size; i++) {
            const x = i % 256;
            const y = Math.floor(i / 256);
            data[i] = (x + y) % 255; 
        }
        return { data, width: 256, height: 256 };
    }

    async getTile({ x, y }: any) {
        return this.getRaster({});
    }
}
