export class Splats {
  private device: GPUDevice;
  private typedArraySplats = new Float32Array();
  vertexBuffer: GPUBuffer;
  splatsBuffer: GPUBuffer;
  outputBuffer: GPUBuffer;

  // struct Splat {
  //  position: vec3f,
  //  opacity: f32,
  //  cov3d1: vec3f,
  //  load_time: f32,
  //  cov3d2: vec3f,
  //  sh: array<vec3f, 16>
  // }

  // struct RenderOutput {
  //   position: vec3f,
  //   opacity: f32,
  //   v1: vec2f,
  //   v2: vec2f,
  //   color: vec3f,
  // }

  constructor({
    device,
    splats,
    numSplatFloats,
    numOutputFloats,
  }: {
    device: GPUDevice;
    splats: Float32Array;
    numSplatFloats: number;
    numOutputFloats: number;
  }) {
    this.device = device;
    this.typedArraySplats = splats;

    // vertex buffer
    const array = new Float32Array([1, -1, 1, 1, -1, -1, 1, 1, -1, -1, -1, 1]);
    this.vertexBuffer = this.device.createBuffer({
      label: "vertices",
      size: array.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(this.vertexBuffer, 0, array);

    // splats buffer
    this.splatsBuffer = this.device.createBuffer({
      label: "splats buffer",
      size: this.typedArraySplats.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // output buffer
    this.outputBuffer = this.device.createBuffer({
      label: "output buffer",
      size:
        (this.typedArraySplats.byteLength / numSplatFloats) * numOutputFloats,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  uploadSplats(byteStart: number, byteEnd: number) {
    if (!this.splatsBuffer) {
      console.warn("Storage buffer not set.");
      return;
    }

    this.device.queue.writeBuffer(
      this.splatsBuffer,
      byteStart,
      this.typedArraySplats,
      byteStart / Float32Array.BYTES_PER_ELEMENT,
      (byteEnd - byteStart) / Float32Array.BYTES_PER_ELEMENT
    );
  }
}
