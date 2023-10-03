import { loadIntoDB, sortByDistance } from "./duckdb";

export class Sorter {
  output = new Uint32Array();

  async init(splats: Float32Array, offset: number, stride: number) {
    await loadIntoDB(splats, offset, stride);
    this.output = new Uint32Array((splats.length / stride) * 6);
  }

  async sortByDistance(position: [x: number, y: number, z: number]) {
    const sortedIndices = await sortByDistance(position);
    const splatCount = this.output.length / 6;

    for (let i = 0; i < sortedIndices.length; i++) {
      this.output[i * 6 + 0] = sortedIndices[i];
      this.output[i * 6 + 1] = sortedIndices[i] + splatCount;
      this.output[i * 6 + 2] = sortedIndices[i] + splatCount * 2;
      this.output[i * 6 + 3] = sortedIndices[i] + splatCount * 3;
      this.output[i * 6 + 4] = sortedIndices[i] + splatCount * 4;
      this.output[i * 6 + 5] = sortedIndices[i] + splatCount * 5;
    }

    return this.output;
  }
}
